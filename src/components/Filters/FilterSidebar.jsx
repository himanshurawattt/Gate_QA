import React from 'react';
import YearFilter from './YearFilter';
import YearRangeFilter from './YearRangeFilter';
import TopicFilter from './TopicFilter';
import ProgressBar from './ProgressBar';
import ProgressFilterToggles from './ProgressFilterToggles';
import { useFilters } from '../../contexts/FilterContext';

const TYPE_BUTTON_STYLES = {
    MCQ: {
        selected: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
        unselected: 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 hover:text-gray-700'
    },
    MSQ: {
        selected: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200',
        unselected: 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 hover:text-gray-700'
    },
    NAT: {
        selected: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
        unselected: 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 hover:text-gray-700'
    }
};
const QUESTION_TYPES = ['MCQ', 'MSQ', 'NAT'];

const FilterSidebar = ({ className = "", onClose }) => {
    const {
        filteredQuestions,
        totalQuestions,
        filters,
        updateFilters,
        clearFilters,
        solvedCount,
        bookmarkedCount,
        progressPercentage,
        isProgressStorageAvailable,
        setHideSolved,
        setShowOnlyBookmarked,
        setShowOnlySolved
    } = useFilters();
    const selectedTypes = Array.isArray(filters.selectedTypes) ? filters.selectedTypes : [...QUESTION_TYPES];

    return (
        <aside className={`flex flex-col flex-shrink-0 bg-gray-50 border-r border-gray-200 h-full min-h-0 overflow-y-auto ${className}`}>
            {/* Reset / Clean filters (if needed) */}
            <div className="p-4 border-b border-gray-200 bg-white z-10 flex justify-between items-center flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700">
                    {filteredQuestions.length} / {totalQuestions} results
                </span>
                <div className="flex items-center gap-2">
                    {(filters.selectedYears.length > 0 || filters.selectedTopics.length > 0 || filters.selectedSubtopics.length > 0 || selectedTypes.length < QUESTION_TYPES.length || filters.hideSolved || filters.showOnlySolved || filters.showOnlyBookmarked) && (
                        <button
                            onClick={clearFilters}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide"
                        >
                            Reset
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 md:hidden">
                            <span className="sr-only">Close</span>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 border-b border-gray-200 bg-white z-10 flex-shrink-0">
                <div className="flex flex-col lg:flex-row gap-4 h-full items-stretch">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <ProgressBar
                            solvedCount={solvedCount}
                            totalQuestions={totalQuestions}
                            progressPercentage={progressPercentage}
                            className="flex-1"
                        />
                        {!isProgressStorageAvailable && (
                            <p className="mt-2 text-xs text-amber-700">
                                Progress persistence is unavailable.
                            </p>
                        )}
                    </div>
                    <div className="lg:w-[45%] flex flex-col justify-center">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 h-full flex flex-col justify-center">
                            <ProgressFilterToggles
                                hideSolved={filters.hideSolved}
                                showOnlySolved={filters.showOnlySolved}
                                showOnlyBookmarked={filters.showOnlyBookmarked}
                                onToggleHideSolved={setHideSolved}
                                onToggleShowOnlySolved={setShowOnlySolved}
                                onToggleShowBookmarked={setShowOnlyBookmarked}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Type Filter (Horizontal Toggles) */}
            <div className="p-4 border-b border-gray-200 bg-white z-10 relative flex-shrink-0">
                <div className="mb-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Question Type</h3>
                </div>
                <div className="flex gap-2">
                    {QUESTION_TYPES.map((type) => {
                        const isSelected = selectedTypes.includes(type);
                        const typeStyle = TYPE_BUTTON_STYLES[type];

                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const current = selectedTypes;
                                    let next;
                                    if (current.includes(type)) {
                                        next = current.filter(t => t !== type);
                                    } else {
                                        next = [...current, type];
                                    }
                                    updateFilters({ selectedTypes: next });
                                }}
                                aria-pressed={isSelected}
                                className={`flex-1 rounded-lg border px-1 py-2 text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 cursor-pointer pointer-events-auto relative z-20 ${isSelected ? typeStyle.selected : typeStyle.unselected}`}
                            >
                                {type}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Scrollable Filter Content */}
            <div className="p-2 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:h-[min(42vh,24rem)] md:min-h-[14rem]">

                    {/* Left Column: Topics */}
                    <div className="md:border-r border-gray-200 pr-0 md:pr-2 flex flex-col min-h-0 overflow-hidden">
                        <div className="py-2 mb-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Topics</h3>
                        </div>
                        <div className="overflow-y-auto max-h-56 md:max-h-none md:flex-1 md:min-h-0 custom-scrollbar">
                            <TopicFilter />
                        </div>
                    </div>

                    {/* Right Column: Years */}
                    <div className="pl-0 md:pl-2 flex flex-col min-h-0 overflow-hidden">
                        <div className="py-2 mb-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Years</h3>
                        </div>
                        <div className="overflow-y-auto max-h-56 md:max-h-none md:flex-1 md:min-h-0 custom-scrollbar">
                            <YearFilter />
                        </div>
                    </div>

                </div>
            </div>

            {/* Sticky Bottom: Year Range */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 z-10 flex-shrink-0">
                <div className="mb-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Year Range</h3>
                </div>
                <YearRangeFilter />

                <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-xs text-gray-500 text-center">
                        {bookmarkedCount} bookmarked questions in current view
                    </p>
                </div>
            </div>
        </aside>
    );
};

export default FilterSidebar;
