
import React from 'react';
import { FaTimes, FaHeart } from 'react-icons/fa';

const SupportModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Content */}
            <div
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm flex flex-col items-center text-center p-8"
                role="dialog"
                aria-labelledby="support-modal-title"
                aria-modal="true"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close modal"
                >
                    <FaTimes />
                </button>

                {/* Icon */}
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                    <FaHeart className="w-8 h-8 text-red-500 animate-pulse" />
                </div>

                {/* Content */}
                <h2 id="support-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Support Me
                </h2>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Thank you for your interest in supporting this project!
                    <br />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Payment options are coming soon.</span>
                </p>

                {/* Footer Action */}
                <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-lg transition-colors w-full"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
};

export default SupportModal;
