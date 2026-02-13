from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import (
    canonical_gateoverflow_url,
    ensure_dir,
    extract_gateoverflow_numeric_id,
    flatten_page_ranges,
    now_iso,
    read_json,
    write_json,
)

ID_LINE_PATTERN = re.compile(r"^\s*(\d+\.\d+\.\d+)\s*$")


def _load_fitz():
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError(
            "PyMuPDF is required for page extraction. Install with: pip install pymupdf"
        ) from exc
    return fitz


def _iter_subject_entries(subject_map: dict[str, Any], volume_key: str) -> list[tuple[str, list[int]]]:
    entries = subject_map.get(volume_key, [])
    resolved: list[tuple[str, list[int]]] = []

    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        subject_group = entry.get("subject_group", f"{volume_key}_group_{idx + 1}")
        pages = set(flatten_page_ranges(entry.get("page_ranges", [])))
        pages.update(int(page) for page in entry.get("pages", []) if isinstance(page, int))
        if pages:
            resolved.append((subject_group, sorted(pages)))

    return resolved


def _extract_id_lines(page_text: str) -> list[str]:
    ids: list[str] = []
    for raw_line in page_text.splitlines():
        match = ID_LINE_PATTERN.match(raw_line)
        if match:
            ids.append(match.group(1))
    return ids


def _extract_question_urls(page: Any) -> list[str]:
    urls: list[str] = []
    seen_ids: set[str] = set()
    for link in page.get_links():
        uri = str(link.get("uri") or "").strip()
        if not uri:
            continue
        question_id = extract_gateoverflow_numeric_id(uri)
        if not question_id or question_id in seen_ids:
            continue
        seen_ids.add(question_id)
        urls.append(canonical_gateoverflow_url(question_id))
    return urls


def _build_id_url_pairs(id_lines: list[str], question_urls: list[str]) -> tuple[list[dict[str, str]], bool]:
    if not id_lines or not question_urls:
        return [], False

    mapped = min(len(id_lines), len(question_urls))
    pairs = [{"id_str": id_lines[i], "question_url": question_urls[i]} for i in range(mapped)]
    counts_match = len(id_lines) == len(question_urls)
    return pairs, counts_match


def _resolve_crop_margins(
    *,
    subject_entry: dict[str, Any],
    crop_left: float,
    crop_right: float,
    crop_top: float,
    crop_bottom: float,
) -> tuple[float, float, float, float]:
    margins = subject_entry.get("crop_margins", {}) if isinstance(subject_entry, dict) else {}
    left = float(margins.get("left", crop_left))
    right = float(margins.get("right", crop_right))
    top = float(margins.get("top", crop_top))
    bottom = float(margins.get("bottom", crop_bottom))

    left = max(0.0, min(0.3, left))
    right = max(0.0, min(0.3, right))
    top = max(0.0, min(0.3, top))
    bottom = max(0.0, min(0.3, bottom))
    return left, right, top, bottom


def extract_answer_pages(
    vol1_path: str | Path,
    vol2_path: str | Path,
    subject_map_path: str | Path,
    out_dir: str | Path,
    dpi: int = 400,
    crop_left: float = 0.03,
    crop_right: float = 0.03,
    crop_top: float = 0.05,
    crop_bottom: float = 0.05,
) -> Path:
    fitz = _load_fitz()

    out_root = ensure_dir(out_dir)
    out_vol1 = ensure_dir(out_root / "vol1")
    out_vol2 = ensure_dir(out_root / "vol2")
    subject_map = read_json(subject_map_path)

    manifest_items: list[dict[str, Any]] = []
    extraction_errors: list[dict[str, Any]] = []

    volume_specs = [
        ("vol1", 1, Path(vol1_path), out_vol1),
        ("vol2", 2, Path(vol2_path), out_vol2),
    ]

    for volume_key, volume_number, pdf_path, volume_out in volume_specs:
        if not pdf_path.exists():
            extraction_errors.append(
                {
                    "volume": volume_number,
                    "reason": "missing_pdf",
                    "pdf_path": str(pdf_path),
                }
            )
            continue

        subject_entries = _iter_subject_entries(subject_map, volume_key)
        doc = fitz.open(str(pdf_path))
        try:
            zoom = dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)
            selected_pages: set[int] = set()

            subject_entry_by_group = {entry.get("subject_group"): entry for entry in subject_map.get(volume_key, []) if isinstance(entry, dict)}
            for subject_group, pages in subject_entries:
                subject_entry = subject_entry_by_group.get(subject_group, {})
                resolved_left, resolved_right, resolved_top, resolved_bottom = _resolve_crop_margins(
                    subject_entry=subject_entry,
                    crop_left=crop_left,
                    crop_right=crop_right,
                    crop_top=crop_top,
                    crop_bottom=crop_bottom,
                )
                for page_no in pages:
                    if page_no < 1 or page_no > len(doc):
                        extraction_errors.append(
                            {
                                "volume": volume_number,
                                "subject_group": subject_group,
                                "page_no": page_no,
                                "reason": "page_out_of_range",
                            }
                        )
                        continue

                    selected_pages.add(page_no)
                    page = doc.load_page(page_no - 1)
                    image_path = volume_out / f"page_{page_no:04d}.png"
                    page_rect = page.rect
                    clip_rect = fitz.Rect(
                        page_rect.x0 + page_rect.width * resolved_left,
                        page_rect.y0 + page_rect.height * resolved_top,
                        page_rect.x1 - page_rect.width * resolved_right,
                        page_rect.y1 - page_rect.height * resolved_bottom,
                    )
                    if clip_rect.width <= 10 or clip_rect.height <= 10:
                        clip_rect = page_rect
                    pix = page.get_pixmap(matrix=matrix, alpha=False, clip=clip_rect)
                    pix.save(str(image_path))

                    text = page.get_text("text")
                    id_lines = _extract_id_lines(text)
                    question_urls = _extract_question_urls(page)
                    id_url_pairs, counts_match = _build_id_url_pairs(id_lines, question_urls)

                    manifest_items.append(
                        {
                            "volume": volume_number,
                            "volume_key": volume_key,
                            "subject_group": subject_group,
                            "page_no": page_no,
                            "pdf_path": str(pdf_path),
                            "image_path": str(image_path),
                            "id_url_pairs": id_url_pairs,
                            "id_line_count": len(id_lines),
                            "question_url_count": len(question_urls),
                            "id_url_counts_match": counts_match,
                            "crop_margins": {
                                "left": resolved_left,
                                "right": resolved_right,
                                "top": resolved_top,
                                "bottom": resolved_bottom,
                            },
                        }
                    )

            if not selected_pages:
                extraction_errors.append(
                    {
                        "volume": volume_number,
                        "reason": "no_pages_selected",
                    }
                )
        finally:
            doc.close()

    manifest = {
        "generated_at": now_iso(),
        "dpi": dpi,
        "source_subject_map": str(subject_map_path),
        "item_count": len(manifest_items),
        "errors": extraction_errors,
        "items": sorted(manifest_items, key=lambda item: (item["volume"], item["page_no"])),
    }
    manifest_path = out_root / "manifest.json"
    write_json(manifest_path, manifest)
    return manifest_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract answer-key pages from PDFs.")
    parser.add_argument("--vol1", required=True, help="Path to volume 1 PDF.")
    parser.add_argument("--vol2", required=True, help="Path to volume 2 PDF.")
    parser.add_argument("--subject-map", required=True, help="Path to data/subject_map.json.")
    parser.add_argument("--out", default="artifacts/answer_pages", help="Output directory.")
    parser.add_argument("--dpi", type=int, default=400, help="Render DPI.")
    parser.add_argument("--crop-left", type=float, default=0.03, help="Left crop margin ratio.")
    parser.add_argument("--crop-right", type=float, default=0.03, help="Right crop margin ratio.")
    parser.add_argument("--crop-top", type=float, default=0.05, help="Top crop margin ratio.")
    parser.add_argument("--crop-bottom", type=float, default=0.05, help="Bottom crop margin ratio.")
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    manifest_path = extract_answer_pages(
        vol1_path=args.vol1,
        vol2_path=args.vol2,
        subject_map_path=args.subject_map,
        out_dir=args.out,
        dpi=args.dpi,
        crop_left=args.crop_left,
        crop_right=args.crop_right,
        crop_top=args.crop_top,
        crop_bottom=args.crop_bottom,
    )
    print(f"Manifest written to {manifest_path}")


if __name__ == "__main__":
    main()
