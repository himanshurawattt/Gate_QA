import React, { useEffect } from 'react';
import { useFilters } from '../../contexts/FilterContext';
import FilterSidebar from './FilterSidebar';
import { FaTimes } from 'react-icons/fa';

const FilterModal = ({ isOpen, onClose }) => {
    const { filteredQuestions, totalQuestions } = useFilters();

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                >
                    <FaTimes className="h-6 w-6" />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                <FilterSidebar className="w-full border-r-0" />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                    onClick={onClose}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                >
                    Show {filteredQuestions.length} Questions
                </button>
            </div>
        </div>
    );
};

export default FilterModal;
