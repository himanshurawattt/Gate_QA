import React, { useState } from 'react';
import { useFilters } from '../../contexts/FilterContext';
import { FaChevronRight, FaChevronDown } from 'react-icons/fa';

const TopicFilter = () => {
    const { structuredTags, filters, updateFilters } = useFilters();
    const { structuredTopics } = structuredTags;
    const { selectedTopics, selectedSubtopics } = filters;
    const [expandedTopics, setExpandedTopics] = useState([]);

    const toggleTopicExpand = (topic) => {
        if (expandedTopics.includes(topic)) {
            setExpandedTopics(expandedTopics.filter(t => t !== topic));
        } else {
            setExpandedTopics([...expandedTopics, topic]);
        }
    };

    const handleTopicChange = (topic) => {
        let newSelectedTopics;
        if (selectedTopics.includes(topic)) {
            newSelectedTopics = selectedTopics.filter(t => t !== topic);
            // Optional: Auto-deselect subtopics if parent is deselected?
            // For now, let's keep them selected or maybe clear them.
        } else {
            newSelectedTopics = [...selectedTopics, topic];
            // Auto-expand when selected
            if (!expandedTopics.includes(topic)) {
                setExpandedTopics([...expandedTopics, topic]);
            }
        }
        updateFilters({ selectedTopics: newSelectedTopics });
    };

    const handleSubtopicChange = (subtopic) => {
        let newSelectedSubtopics;
        if (selectedSubtopics.includes(subtopic)) {
            newSelectedSubtopics = selectedSubtopics.filter(t => t !== subtopic);
        } else {
            newSelectedSubtopics = [...selectedSubtopics, subtopic];
        }
        updateFilters({ selectedSubtopics: newSelectedSubtopics });
    }

    const topics = Object.keys(structuredTopics || {});

    if (topics.length === 0) return null;

    return (
        <div className="space-y-1">
            {topics.map(topic => {
                const subtopics = structuredTopics[topic] || [];
                const isExpanded = expandedTopics.includes(topic);
                const isSelected = selectedTopics.includes(topic);
                const hasSubtopics = subtopics.length > 0;

                return (
                    <div key={topic} className="flex flex-col">
                        <div className="flex items-center justify-between group py-1">
                            <label className="flex items-center cursor-pointer flex-grow">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={isSelected}
                                    onChange={() => handleTopicChange(topic)}
                                />
                                <span className={`ml-3 text-sm capitalize truncate ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`} title={topic.replace(/-/g, ' ')}>
                                    {topic.replace(/-/g, ' ')}
                                </span>
                            </label>
                            {hasSubtopics && (
                                <button
                                    onClick={() => toggleTopicExpand(topic)}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400"
                                >
                                    {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                                </button>
                            )}
                        </div>

                        {hasSubtopics && isExpanded && (
                            <div className="ml-6 pl-2 border-l-2 border-gray-200 space-y-1 mt-1">
                                {subtopics.map(sub => (
                                    <label key={sub} className="flex items-center cursor-pointer py-0.5 group/sub">
                                        <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-gray-300 text-blue-500 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700"
                                            checked={selectedSubtopics.includes(sub)}
                                            onChange={() => handleSubtopicChange(sub)}
                                        />
                                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 group-hover/sub:text-gray-800 dark:group-hover/sub:text-gray-200">
                                            {sub.replace(/-/g, ' ')}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default TopicFilter;
