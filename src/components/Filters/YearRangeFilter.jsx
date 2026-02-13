import React from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useFilters } from '../../contexts/FilterContext';

const YearRangeFilter = () => {
    const { structuredTags, filters, updateFilters } = useFilters();
    const { minYear, maxYear } = structuredTags;
    const { yearRange } = filters;

    if (minYear === 0 || maxYear === 0) return null;

    const handleRangeChange = (newRange) => {
        updateFilters({ yearRange: newRange });
    };

    return (
        <div className="px-2 py-4">
            <div className="flex justify-between text-sm text-gray-600 mb-4">
                <span>{yearRange ? yearRange[0] : minYear}</span>
                <span>{yearRange ? yearRange[1] : maxYear}</span>
            </div>
            <Slider
                range
                min={minYear}
                max={maxYear}
                defaultValue={[minYear, maxYear]}
                value={yearRange || [minYear, maxYear]}
                onChange={handleRangeChange}
                trackStyle={[{ backgroundColor: '#3b82f6' }]}
                handleStyle={[
                    { borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
                    { borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
                ]}
                railStyle={{ backgroundColor: '#e5e7eb' }}
            />
        </div>
    );
};

export default YearRangeFilter;
