
import React from 'react';
import { FaTimes, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';

const DataPolicyModal = ({ isOpen, onClose }) => {
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
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                role="dialog"
                aria-labelledby="modal-title"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FaShieldAlt className="text-blue-500" />
                        Data Persistence & Privacy Policy
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Close modal"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 text-gray-700 dark:text-gray-300 space-y-6">

                    <section>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                            <FaExclamationTriangle className="text-amber-500" />
                            Important: When is data NOT saved?
                        </h3>
                        <p className="mb-3 text-sm leading-relaxed">
                            Your progress (Solved status, Bookmarks) is stored locally on your device using <strong>Browser LocalStorage</strong>.
                            We do not store any data on a central server. This means your data remains private, but it also has limitations.
                        </p>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <ul className="list-disc list-outside ml-4 space-y-2 text-sm text-amber-900 dark:text-amber-200">
                                <li>
                                    <strong>Incognito / Private Mode:</strong> Data is erased immediately when you close the private window.
                                </li>
                                <li>
                                    <strong>Clearing Browser Data:</strong> If you manually clear your "Cookies and Site Data" or "LocalStorage", all progress will be lost.
                                </li>
                                <li>
                                    <strong>Different Devices/Browsers:</strong> Progress does NOT sync between your phone and laptop, or between Chrome and Safari. Each browser has its own separate storage.
                                </li>
                                <li>
                                    <strong>Storage Quota Exceeded:</strong> In rare cases, if your device is running critically low on space, the browser may prevent saving new data.
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
                            How to protect your data?
                        </h3>
                        <ul className="list-disc list-outside ml-4 space-y-2 text-sm">
                            <li>Avoid using Private/Incognito windows if you want to save progress.</li>
                            <li>Stick to one browser on one device for the best experience.</li>
                            <li>Periodically check that your bookmarks are persisting after a page reload.</li>
                        </ul>
                    </section>

                    <section className="pt-4 border-t dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            This application is open-source and client-side only. No personal data is ever sent to our servers.
                        </p>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataPolicyModal;
