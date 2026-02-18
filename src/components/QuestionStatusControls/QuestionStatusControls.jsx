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
                        ? 'border border-green-600 bg-green-600 text-white'
                        : 'border border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
            >
                <FaCheck className={isSolved ? 'text-white' : 'text-green-700'} />
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
                        ? 'border border-yellow-400 bg-yellow-400 text-white'
                        : 'border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    }`}
            >
                {isBookmarked ? <FaStar className="text-white" /> : <FaRegStar className="text-yellow-700" />}
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
        </>
    );
};

export default QuestionStatusControls;
