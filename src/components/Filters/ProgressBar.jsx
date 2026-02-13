import React from 'react';

const ProgressBar = ({ solvedCount = 0, totalQuestions = 0, progressPercentage = 0 }) => {
    const boundedPercentage = Math.max(0, Math.min(100, progressPercentage));
    const allSolved = totalQuestions > 0 && solvedCount >= totalQuestions;

    return (
        <div className="rounded-lg border border-green-100 bg-green-50/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Your Progress
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
                    style={{ width: `${boundedPercentage}%` }}
                />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>
                    <span className="font-semibold text-gray-700">{solvedCount}</span> / {totalQuestions} solved
                </span>
                <span>{boundedPercentage}% complete</span>
            </div>

            {allSolved && (
                <div className="mt-2 rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                    Congratulations! All questions solved.
                </div>
            )}
        </div>
    );
};

export default ProgressBar;
