import React from 'react';

const ToggleRow = ({ id, label, checked, onChange }) => {
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <span className="relative inline-flex h-6 w-11 items-center">
                <input
                    id={id}
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors duration-200 peer-checked:bg-blue-500" />
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
            </span>
        </label>
    );
};

const ProgressFilterToggles = ({
    hideSolved = false,
    showOnlyBookmarked = false,
    onToggleHideSolved,
    onToggleShowBookmarked
}) => {
    return (
        <div className="space-y-1">
            <ToggleRow
                id="hide-solved-toggle"
                label="Hide Solved Questions"
                checked={hideSolved}
                onChange={onToggleHideSolved}
            />
            <ToggleRow
                id="show-bookmarked-toggle"
                label="Show Only Bookmarked"
                checked={showOnlyBookmarked}
                onChange={onToggleShowBookmarked}
            />
        </div>
    );
};

export default ProgressFilterToggles;
