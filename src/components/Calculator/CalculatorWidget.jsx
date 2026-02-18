import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_WIDTH = 470;
const DESKTOP_HEIGHT = 340;
const VIEWPORT_MARGIN = 12;
const ANIMATION_DURATION_MS = 180;
const FRAME_TIMEOUT_MS = 6000;

function clampPosition(x, y, width, height) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

function getCalculatorUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}calculator/calculator.html`;
}

export default function CalculatorWidget({ isOpen, onClose, anchorRef }) {
  const panelRef = useRef(null);
  const frameTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dragSessionRef = useRef(null);
  const pendingPositionRef = useRef(null);
  const livePositionRef = useRef({ x: VIEWPORT_MARGIN, y: 80 });
  const isDraggingRef = useRef(false);

  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasFrameError, setHasFrameError] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: VIEWPORT_MARGIN, y: 80 });

  const calculatorUrl = getCalculatorUrl();

  useEffect(() => {
    livePositionRef.current = position;
  }, [position]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        // Recalculate position to keep it in bounds
        setPosition((prev) => clampPosition(prev.x, prev.y, DESKTOP_WIDTH, DESKTOP_HEIGHT));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsLoading(true);
      setHasFrameError(false);
      // Small delay to allow render before transition
      closeTimeoutRef.current = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(closeTimeoutRef.current);
    }

    setIsVisible(false);
    if (!isRendered) return;

    closeTimeoutRef.current = setTimeout(() => {
      setIsRendered(false);
      setIsLoading(false);
      setHasFrameError(false);
    }, ANIMATION_DURATION_MS);
    return () => clearTimeout(closeTimeoutRef.current);
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered || !isLoading) {
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      return;
    }
    frameTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setHasFrameError(true);
    }, FRAME_TIMEOUT_MS);
    return () => {
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
    };
  }, [isRendered, isLoading]);

  // Initial positioning logic
  useEffect(() => {
    if (!isOpen || isMobile || hasDragged) return;

    const anchorRect = anchorRef?.current?.getBoundingClientRect();
    if (!anchorRect) return;

    const preferredX = anchorRect.right - DESKTOP_WIDTH;
    const preferredY = anchorRect.bottom + 8;
    setPosition(clampPosition(preferredX, preferredY, DESKTOP_WIDTH, DESKTOP_HEIGHT));
  }, [anchorRef, hasDragged, isMobile, isOpen]);

  const handleMouseMove = useCallback((event) => {
    if (!dragSessionRef.current || !panelRef.current) {
      return;
    }

    const { offsetX, offsetY } = dragSessionRef.current;
    const rawX = event.clientX - offsetX;
    const rawY = event.clientY - offsetY;
    pendingPositionRef.current = clampPosition(rawX, rawY, DESKTOP_WIDTH, DESKTOP_HEIGHT);

    if (animationFrameRef.current) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      if (!panelRef.current || !pendingPositionRef.current) {
        return;
      }
      panelRef.current.style.left = `${pendingPositionRef.current.x}px`;
      panelRef.current.style.top = `${pendingPositionRef.current.y}px`;
      livePositionRef.current = pendingPositionRef.current;
    });
  }, []);

  const stopDragging = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);
    dragSessionRef.current = null;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (pendingPositionRef.current && panelRef.current) {
      panelRef.current.style.left = `${pendingPositionRef.current.x}px`;
      panelRef.current.style.top = `${pendingPositionRef.current.y}px`;
      livePositionRef.current = pendingPositionRef.current;
    }

    pendingPositionRef.current = null;
    setPosition(livePositionRef.current);

    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", stopDragging);
    window.removeEventListener("blur", stopDragging);
  }, [handleMouseMove]);

  useEffect(() => {
    if (!isOpen) {
      stopDragging();
    }
  }, [isOpen, stopDragging]);

  // Clean up drag listeners / RAF on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, [handleMouseMove, stopDragging]);

  const beginDrag = (event) => {
    if (isMobile) return;
    if (event.target.closest("button")) return;
    if (isDraggingRef.current) return;

    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) return;

    event.preventDefault();
    setHasDragged(true);
    isDraggingRef.current = true;
    setIsDragging(true);

    dragSessionRef.current = {
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
    };
    livePositionRef.current = { x: panelRect.left, y: panelRect.top };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("blur", stopDragging);
  };

  const handleFrameLoaded = () => {
    setIsLoading(false);
    setHasFrameError(false);
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
  };

  const handleFrameError = () => {
    setIsLoading(false);
    setHasFrameError(true);
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
  };

  if (!isRendered) return null;

  const panelPositionStyle = isMobile
    ? undefined
    : { left: `${position.x}px`, top: `${position.y}px` };

  const panelAnimationClass = isMobile
    ? isVisible
      ? "translate-y-0 opacity-100"
      : "translate-y-4 opacity-0"
    : isVisible
      ? "scale-100 opacity-100"
      : "scale-95 opacity-0";
  const panelTransitionClass = isDragging
    ? "transition-none"
    : "transition-all duration-200";

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none">
      <section
        ref={panelRef}
        className={`absolute pointer-events-auto overflow-hidden border border-gray-200 bg-white shadow-2xl ${panelTransitionClass} ${panelAnimationClass} ${isMobile
          ? "inset-0 h-screen w-screen rounded-none"
          : "h-[340px] w-[470px] rounded-xl"
          }`}
        style={panelPositionStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Scientific calculator"
      >
        <header
          className={`flex items-center justify-between border-b border-gray-200 px-4 py-2.5 ${isMobile ? "cursor-default" : "cursor-move"
            }`}
          onMouseDown={beginDrag}
        >
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              GATE Scientific Calculator
            </h3>
            <p className="text-[11px] text-gray-600">
              {isMobile ? "Mobile mode" : "Drag by header on desktop"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close calculator"
            >
              <FaTimes />
            </button>
          </div>
        </header>

        <div className="relative h-[calc(100%-41px)] w-full bg-gray-50">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-medium text-gray-700">
              Loading calculator...
            </div>
          )}

          {hasFrameError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white px-4 text-center">
              <p className="text-sm font-semibold text-amber-700">
                Unable to render the calculator in this view.
              </p>
              <p className="text-xs text-gray-600">
                Try closing and reopening it.
              </p>
            </div>
          )}

          {/* 
            Overlay to capture mouse events during drag.
            This prevents the iframe from swallowing mousemove events,
            which causes the drag to lag or stop.
          */}
          {isDragging && !isMobile && (
            <div className="absolute inset-0 z-50 bg-transparent" />
          )}

          <iframe
            src={calculatorUrl}
            title="GATE Scientific Calculator"
            className="h-full w-full border-0"
            onLoad={handleFrameLoaded}
            onError={handleFrameError}
            // Also add pointer-events-none style directly to iframe when dragging as a backup
            style={isDragging ? { pointerEvents: "none" } : undefined}
          />
        </div>
      </section>
    </div>
  );
}
