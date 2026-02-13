import React from 'react';
import { useFilters } from '../../contexts/FilterContext';

const YearFilter = () => {
    const { structuredTags, filters, updateFilters } = useFilters();
    const { years } = structuredTags;
    const { selectedYears } = filters;

    const handleYearChange = (yearTag) => {
        let newSelectedYears;
        if (selectedYears.includes(yearTag)) {
            newSelectedYears = selectedYears.filter(y => y !== yearTag);
        } else {
            newSelectedYears = [...selectedYears, yearTag];
        }
        updateFilters({ selectedYears: newSelectedYears });
    };

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

    if (!years || years.length === 0) return null;

    const sortedYears = [...years].sort((a, b) => {
        const getYear = (tag) => {
            const match = tag.match(/(\d{4})/);
            return match ? parseInt(match[1], 10) : 0;
        };
        const yearA = getYear(a);
        const yearB = getYear(b);

        if (yearA !== yearB) {
            return yearB - yearA; // Descending by Year
        }
        // Secondary descending sort for Sets strings (e.g. Set 2 before Set 1)
        return b.localeCompare(a, undefined, { numeric: true });
    });

    return (
        <div className="space-y-2">
            {sortedYears.map((yearTag) => {
                const displayYear = formatYear(yearTag);
                const isSelected = selectedYears.includes(yearTag);

                return (
                    <label key={yearTag} className="flex items-center cursor-pointer group">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={isSelected}
                            onChange={() => handleYearChange(yearTag)}
                        />
                        <span className={`ml-3 text-sm transition-colors ${isSelected ? 'font-medium text-blue-600' : 'text-gray-600 group-hover:text-gray-900'}`}>
                            {displayYear}
                        </span>
                    </label>
                );
            })}
        </div>
    );
};

export default YearFilter;
