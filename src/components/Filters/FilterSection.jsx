import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FilterSection = ({ title, children, defaultOpen = true, count = 0 }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 py-4">
            <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="flex items-center">
                    {title}
                    {count > 0 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            {count}
                        </span>
                    )}
                </span>
                <span className="ml-6 flex items-center">
                    {isOpen ? (
                        <FaChevronUp className="h-3 w-3 text-gray-400" />
                    ) : (
                        <FaChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                </span>
            </button>
            {isOpen && (
                <div className="mt-4 space-y-2 animate-fadeIn">
                    {children}
                </div>
            )}
        </div>
    );
};

export default FilterSection;
