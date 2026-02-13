from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import ensure_dir, read_json, write_json


def _load_paddle_ocr(lang: str):
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. Install with: pip install paddleocr"
        ) from exc
    return PaddleOCR(use_angle_cls=True, lang=lang, enable_mkldnn=False)


def _parse_paddle_lines(raw_result: Any) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    if not raw_result:
        return lines

    page_result = raw_result[0] if isinstance(raw_result, list) and raw_result else raw_result
    if not isinstance(page_result, list):
        return lines

    for line_index, line in enumerate(page_result):
        if not isinstance(line, (list, tuple)) or len(line) < 2:
            continue
        bbox, text_info = line[0], line[1]
        text = ""
        confidence = 0.0
        if isinstance(text_info, (list, tuple)) and text_info:
            text = str(text_info[0]).strip()
            if len(text_info) > 1:
                try:
                    confidence = float(text_info[1])
                except (TypeError, ValueError):
                    confidence = 0.0
        if not text:
            continue
        lines.append(
            {
                "line_index": line_index,
                "text": text,
                "confidence": confidence,
                "bbox": bbox,
            }
        )
    return lines


def _ocr_with_paddle(image_path: Path, paddle_ocr: Any) -> list[dict[str, Any]]:
    result = paddle_ocr.ocr(str(image_path))
    return _parse_paddle_lines(result)


def _preprocess_image(
    *,
    image_path: Path,
    preprocess_dir: Path,
    preprocess_mode: str,
    threshold: int,
    denoise_radius: int,
    scale: float,
) -> Path:
    from PIL import Image, ImageFilter, ImageOps

    preprocess_dir = ensure_dir(preprocess_dir)
    out_path = preprocess_dir / image_path.name
    image = Image.open(image_path).convert("L")

    if scale and scale > 1.0:
        image = image.resize(
            (int(image.width * scale), int(image.height * scale)),
            resample=Image.Resampling.LANCZOS,
        )

    image = ImageOps.autocontrast(image, cutoff=2)
    if denoise_radius > 0:
        image = image.filter(ImageFilter.MedianFilter(size=max(3, denoise_radius)))

    if preprocess_mode == "threshold":
        image = image.point(lambda px: 255 if px > threshold else 0, mode="1").convert("L")
    elif preprocess_mode == "adaptive":
        image = image.filter(ImageFilter.GaussianBlur(radius=1))
        image = image.point(lambda px: 255 if px > threshold else 0, mode="1").convert("L")

    image.save(out_path)
    return out_path


def _ocr_with_tesseract(image_path: Path, psm: int = 6) -> list[dict[str, Any]]:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise RuntimeError(
            "Tesseract fallback requires pillow and pytesseract. Install with: pip install pillow pytesseract"
        ) from exc

    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if Path(tesseract_path).exists():
        pytesseract.pytesseract.tesseract_cmd = tesseract_path

    image = Image.open(image_path)
    data = pytesseract.image_to_data(
        image,
        config=f"--psm {psm}",
        output_type=pytesseract.Output.DICT,
    )
    grouped: dict[tuple[int, int, int], list[tuple[str, float]]] = {}

    total = len(data.get("text", []))
    for idx in range(total):
        token = str(data["text"][idx]).strip()
        if not token:
            continue
        conf_raw = data.get("conf", ["0"] * total)[idx]
        try:
            confidence = float(conf_raw)
        except (TypeError, ValueError):
            confidence = 0.0
        if confidence < 0:
            continue
        key = (
            int(data.get("block_num", [0] * total)[idx]),
            int(data.get("par_num", [0] * total)[idx]),
            int(data.get("line_num", [0] * total)[idx]),
        )
        grouped.setdefault(key, []).append((token, confidence))

    lines: list[dict[str, Any]] = []
    for line_index, key in enumerate(sorted(grouped.keys())):
        tokens = grouped[key]
        text = " ".join(item[0] for item in tokens).strip()
        if not text:
            continue
        confidence = sum(item[1] for item in tokens) / len(tokens)
        lines.append(
            {
                "line_index": line_index,
                "text": text,
                "confidence": confidence / 100.0,
                "bbox": [],
            }
        )
    return lines


def ocr_answer_pages(
    manifest_path: str | Path,
    out_dir: str | Path,
    engine: str = "paddle",
    lang: str = "en",
    preprocess_mode: str = "none",
    threshold: int = 165,
    denoise_radius: int = 3,
    scale: float = 1.3,
    tesseract_psm: int = 6,
) -> Path:
    out_root = ensure_dir(out_dir)
    preprocess_root = ensure_dir(out_root.parent / "ocr_preprocessed")
    manifest = read_json(manifest_path)
    items = manifest.get("items", [])
    if not isinstance(items, list):
        raise RuntimeError("Manifest format invalid: expected 'items' list.")

    paddle_ocr = None
    if engine == "paddle":
        paddle_ocr = _load_paddle_ocr(lang=lang)
    elif engine != "tesseract":
        raise RuntimeError(f"Unsupported OCR engine '{engine}'. Use 'paddle' or 'tesseract'.")

    failures: list[dict[str, Any]] = []
    total_lines = 0
    for item in items:
        image_path = Path(item["image_path"])
        if not image_path.exists():
            failures.append(
                {
                    "volume": item.get("volume"),
                    "page_no": item.get("page_no"),
                    "reason": "missing_image",
                    "image_path": str(image_path),
                }
            )
            continue

        ocr_image_path = image_path
        if preprocess_mode != "none":
            try:
                ocr_image_path = _preprocess_image(
                    image_path=image_path,
                    preprocess_dir=preprocess_root / f"vol{item.get('volume')}",
                    preprocess_mode=preprocess_mode,
                    threshold=threshold,
                    denoise_radius=denoise_radius,
                    scale=scale,
                )
            except Exception as exc:  # noqa: BLE001
                failures.append(
                    {
                        "volume": item.get("volume"),
                        "page_no": item.get("page_no"),
                        "reason": "preprocess_failed",
                        "error": str(exc),
                    }
                )
                continue

        try:
            if engine == "paddle":
                lines = _ocr_with_paddle(ocr_image_path, paddle_ocr)
            else:
                lines = _ocr_with_tesseract(ocr_image_path, psm=tesseract_psm)
        except Exception as exc:  # noqa: BLE001
            failures.append(
                {
                    "volume": item.get("volume"),
                    "page_no": item.get("page_no"),
                    "reason": "ocr_failed",
                    "error": str(exc),
                }
            )
            continue

        total_lines += len(lines)
        out_file = out_root / f"vol{item.get('volume')}_page_{int(item.get('page_no', 0)):04d}.json"
        write_json(
            out_file,
            {
                "meta": item,
                "engine": engine,
                "ocr_image_path": str(ocr_image_path),
                "preprocess_mode": preprocess_mode,
                "lines": lines,
            },
        )

    summary = {
        "manifest_path": str(manifest_path),
        "engine": engine,
        "preprocess_mode": preprocess_mode,
        "threshold": threshold,
        "denoise_radius": denoise_radius,
        "scale": scale,
        "tesseract_psm": tesseract_psm,
        "page_count": len(items),
        "ocr_line_count": total_lines,
        "failure_count": len(failures),
        "failures": failures,
    }
    summary_path = out_root / "summary.json"
    write_json(summary_path, summary)
    return summary_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run OCR on extracted answer pages.")
    parser.add_argument("--manifest", required=True, help="Path to artifacts/answer_pages/manifest.json.")
    parser.add_argument("--out", default="artifacts/ocr_raw", help="Output directory for OCR results.")
    parser.add_argument(
        "--engine",
        default="tesseract",
        choices=["paddle", "tesseract"],
        help="OCR engine to use.",
    )
    parser.add_argument("--lang", default="en", help="OCR language.")
    parser.add_argument(
        "--preprocess-mode",
        default="threshold",
        choices=["none", "basic", "threshold", "adaptive"],
        help="Image preprocessing mode before OCR.",
    )
    parser.add_argument("--threshold", type=int, default=165, help="Threshold value for binarization.")
    parser.add_argument("--denoise-radius", type=int, default=3, help="Median denoise filter kernel size.")
    parser.add_argument("--scale", type=float, default=1.3, help="Upscale factor before OCR.")
    parser.add_argument("--tesseract-psm", type=int, default=6, help="Tesseract page segmentation mode.")
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    summary_path = ocr_answer_pages(
        manifest_path=args.manifest,
        out_dir=args.out,
        engine=args.engine,
        lang=args.lang,
        preprocess_mode=args.preprocess_mode,
        threshold=args.threshold,
        denoise_radius=args.denoise_radius,
        scale=args.scale,
        tesseract_psm=args.tesseract_psm,
    )
    print(f"OCR summary written to {summary_path}")


if __name__ == "__main__":
    main()
