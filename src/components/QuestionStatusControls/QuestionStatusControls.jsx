import React from 'react';
import { FaCheck, FaRegStar, FaStar } from 'react-icons/fa';

const QuestionStatusControls = ({
    isSolved = false,
    isBookmarked = false,
    disabled = false,
    onToggleSolved,
    onToggleBookmark
}) => {
    return (
        <>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggleSolved}
                aria-pressed={isSolved}
                className={`flex h-12 items-center justify-center gap-2 rounded px-3 text-sm font-semibold shadow-sm transition-colors ${disabled
                    ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                    : isSolved
                        ? 'border border-green-600 bg-green-600 text-white hover:bg-green-700'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
            >
                <FaCheck className={isSolved ? 'text-white' : 'text-gray-400'} />
                <span>{isSolved ? 'Solved' : 'Mark as Solved'}</span>
            </button>

            <button
                type="button"
                disabled={disabled}
                onClick={onToggleBookmark}
                aria-pressed={isBookmarked}
                className={`flex h-12 items-center justify-center gap-2 rounded px-3 text-sm font-semibold shadow-sm transition-colors ${disabled
                    ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                    : isBookmarked
                        ? 'border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
            >
                {isBookmarked ? <FaStar className="text-orange-500" /> : <FaRegStar className="text-gray-400" />}
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
        </>
    );
};

export default QuestionStatusControls;
