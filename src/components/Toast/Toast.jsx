/**
 * Toast.jsx — Generic toast notification component.
 *
 * Shows a fixed-position pill at the bottom-center of the viewport.
 * Accepts `message` (string) and `visible` (boolean) props.
 * Fades in/out via Tailwind opacity transition.
 * Reusable for any future transient notifications (export progress, etc.).
 */
import React from "react";

export default function Toast({ message, visible }) {
    return (
        <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
            role="status"
            aria-live="polite"
        >
            {message}
        </div>
    );
}
