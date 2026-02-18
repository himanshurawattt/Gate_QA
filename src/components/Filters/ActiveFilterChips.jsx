import React from 'react';
import { useFilters } from '../../contexts/FilterContext';
import { FaTimes } from 'react-icons/fa';

const ActiveFilterChips = () => {
    const { filters, updateFilters, clearFilters, structuredTags } = useFilters();
    const {
        selectedYears,
        selectedTopics,
        selectedSubtopics,
        yearRange,
        hideSolved,
        showOnlySolved,
        showOnlyBookmarked
    } = filters;
    const { minYear, maxYear } = structuredTags;

    const removeYear = (year) => {
        updateFilters({ selectedYears: selectedYears.filter(y => y !== year) });
    };

    const removeTopic = (topic) => {
        updateFilters({ selectedTopics: selectedTopics.filter(t => t !== topic) });
    };

    const removeSubtopic = (sub) => {
        updateFilters({ selectedSubtopics: selectedSubtopics.filter(s => s !== sub) });
    };

    const resetRange = () => {
        updateFilters({ yearRange: [minYear, maxYear] });
    };

    const resetHideSolved = () => {
        updateFilters({ hideSolved: false });
    };

    const resetShowOnlySolved = () => {
        updateFilters({ showOnlySolved: false });
    };

    const resetShowBookmarkedOnly = () => {
        updateFilters({ showOnlyBookmarked: false });
    };

    const isRangeActive = yearRange && (yearRange[0] !== minYear || yearRange[1] !== maxYear);
    const hasActiveFilters = selectedYears.length > 0
        || selectedTopics.length > 0
        || selectedSubtopics.length > 0
        || isRangeActive
        || hideSolved
        || showOnlySolved
        || showOnlyBookmarked;

    const formatYear = (tag) => {
        // Remove non-digits first
        const numericPart = tag.replace(/[^0-9]/g, '');
        if (numericPart.length === 5) {
            const year = numericPart.substring(0, 4);
            const setNum = numericPart.substring(4);
            return `${year} Set ${setNum}`;
        }
        return numericPart || tag;
    };

    if (!hasActiveFilters) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-4 animate-fadeIn">
            {selectedYears.map(year => (
                <span key={year} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {formatYear(year)}
                    <button onClick={() => removeYear(year)} className="ml-1.5 inline-flex text-blue-500 hover:text-blue-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            ))}

            {isRangeActive && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {yearRange[0]} - {yearRange[1]}
                    <button onClick={resetRange} className="ml-1.5 inline-flex text-purple-500 hover:text-purple-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            )}

            {selectedTopics.map(topic => (
                <span key={topic} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 capitalize">
                    {topic.replace(/-/g, ' ')}
                    <button onClick={() => removeTopic(topic)} className="ml-1.5 inline-flex text-green-500 hover:text-green-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            ))}

            {selectedSubtopics.map(sub => (
                <span key={sub} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {sub.replace(/-/g, ' ')}
                    <button onClick={() => removeSubtopic(sub)} className="ml-1.5 inline-flex text-yellow-500 hover:text-yellow-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            ))}

            {hideSolved && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Hide solved
                    <button onClick={resetHideSolved} className="ml-1.5 inline-flex text-emerald-500 hover:text-emerald-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            )}

            {showOnlySolved && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Solved only
                    <button onClick={resetShowOnlySolved} className="ml-1.5 inline-flex text-indigo-500 hover:text-indigo-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            )}

            {showOnlyBookmarked && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Bookmarked only
                    <button onClick={resetShowBookmarkedOnly} className="ml-1.5 inline-flex text-orange-500 hover:text-orange-600 focus:outline-none">
                        <FaTimes />
                    </button>
                </span>
            )}

            <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline decoration-dotted"
            >
                Clear all
            </button>
        </div>
    );
};

export default ActiveFilterChips;
