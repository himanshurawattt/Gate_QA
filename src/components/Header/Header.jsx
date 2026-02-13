import React from 'react';

const Header = ({ onOpenFilters }) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="relative flex items-center justify-center py-3 px-4 sm:px-6">

        {/* Centered Title */}
        <div className="text-center flex-1">
          <h1 className="font-bold text-gray-900 text-lg sm:text-xl md:text-2xl tracking-wide" lang="en">
            GRADUATE APTITUDE TEST IN ENGINEERING
          </h1>
          <h2 className="font-medium text-gray-700 text-sm sm:text-base md:text-lg mt-1" lang="hi" style={{ fontFamily: "'Noto Sans Devanagari', 'Mangal', sans-serif" }}>
            अभियांत्रिकी स्नातक अभिक्षमता परीक्षा
          </h2>
        </div>

        {/* Filters Button - Always visible */}
        {onOpenFilters && (
          <button
            onClick={onOpenFilters}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 
                       bg-gray-800 text-white rounded-lg shadow-sm
                       hover:bg-gray-700 transition-colors"
            aria-label="Open filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline text-sm font-medium">Filters</span>
          </button>
        )}

      </div>
    </header>
  );
};

export default Header;
