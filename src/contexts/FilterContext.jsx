import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { QuestionService } from '../services/QuestionService';
import { AnswerService } from '../services/AnswerService';

const FilterContext = createContext();
const DEFAULT_SELECTED_TYPES = ['MCQ', 'MSQ', 'NAT'];

const normalizeSelectedTypes = (rawTypes, { fallbackToDefault = false } = {}) => {
    if (!Array.isArray(rawTypes)) {
        return fallbackToDefault ? [...DEFAULT_SELECTED_TYPES] : [];
    }

    const normalized = rawTypes
        .map(type => String(type || '').trim().toUpperCase())
        .filter(type => DEFAULT_SELECTED_TYPES.includes(type));

    const orderedUnique = DEFAULT_SELECTED_TYPES.filter(type => normalized.includes(type));

    if (fallbackToDefault && orderedUnique.length === 0) {
        return [...DEFAULT_SELECTED_TYPES];
    }

    return orderedUnique;
};

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
};

export const FilterProvider = ({ children }) => {
    const [structuredTags, setStructuredTags] = useState({
        years: [],
        topics: [],
        structuredTopics: {},
        minYear: 2000,
        maxYear: 2025
    });

    const [filters, setFilters] = useState({
        selectedYears: [],
        yearRange: [2000, 2025],
        selectedTopics: [],
        selectedSubtopics: [],
        selectedTypes: [...DEFAULT_SELECTED_TYPES], // Default: All selected
        searchQuery: ""
    });

    const [filteredQuestions, setFilteredQuestions] = useState([]);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize data from QuestionService
    useEffect(() => {
        if (QuestionService.questions.length > 0) {
            const tags = QuestionService.getStructuredTags();
            setStructuredTags(tags);
            setTotalQuestions(QuestionService.questions.length);

            // Initialize Year Range from data if not set/default
            const { minYear, maxYear } = tags;
            setFilters(prev => ({
                ...prev,
                yearRange: [minYear, maxYear]
            }));

            setIsInitialized(true);
        }
    }, [QuestionService.loaded]); // Depend on loaded flag if observable, or we might need a manual trigger

    // Load state from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlTypes = params.get('types');
        const urlFilters = {
            selectedYears: params.get('years')?.split(',').filter(Boolean) || [],
            yearRange: params.get('range')?.split('-').map(Number) || null,
            selectedTopics: params.get('topics')?.split(',').filter(Boolean) || [],
            selectedSubtopics: params.get('subtopics')?.split(',').filter(Boolean) || [],
            selectedTypes: urlTypes === null
                ? [...DEFAULT_SELECTED_TYPES]
                : normalizeSelectedTypes(urlTypes.split(',').filter(Boolean))
        };

        if (urlFilters.yearRange && urlFilters.yearRange.length === 2 && !isNaN(urlFilters.yearRange[0])) {
            setFilters(prev => ({ ...prev, ...urlFilters }));
        } else {
            // Only apply other filters if range is invalid/missing to keep default range from init
            const { yearRange, ...rest } = urlFilters;
            setFilters(prev => ({ ...prev, ...rest }));
        }
    }, []);

    // Update URL when filters change
    useEffect(() => {
        if (!isInitialized) return;

        const params = new URLSearchParams();
        if (filters.selectedYears.length) params.set('years', filters.selectedYears.join(','));
        if (filters.selectedTopics.length) params.set('topics', filters.selectedTopics.join(','));
        if (filters.selectedSubtopics.length) params.set('subtopics', filters.selectedSubtopics.join(','));
        if (filters.yearRange) params.set('range', filters.yearRange.join('-'));

        // Only add 'types' to URL if it's NOT the default (all selected)
        // This keeps the URL cleaner
        const selectedTypes = normalizeSelectedTypes(filters.selectedTypes);
        if (selectedTypes.length > 0 && selectedTypes.length < DEFAULT_SELECTED_TYPES.length) {
            params.set('types', selectedTypes.join(','));
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }, [filters, isInitialized]);

    // Apply filters
    useEffect(() => {
        if (!QuestionService.questions.length) return;

        const { selectedYears, selectedTopics, selectedSubtopics, yearRange } = filters;
        const selectedTypes = normalizeSelectedTypes(filters.selectedTypes);
        const selectedTypeSet = new Set(selectedTypes.map(type => type.toUpperCase()));

        const result = QuestionService.questions.filter(q => {
            // 0. Question Type Filter
            // Check if question type matches any of the selected types

            // Optimization: If all types are selected (default), skip check
            if (selectedTypes.length < DEFAULT_SELECTED_TYPES.length) {
                const answer = AnswerService.getAnswerForQuestion(q);
                const qType = answer ? answer.type : null;

                const normalizedQType = qType ? qType.toUpperCase() : "";
                const typeMatch = normalizedQType && selectedTypeSet.has(normalizedQType);

                if (!typeMatch) return false;
            }



            // 1. Year Filter (Discrete)
            // Extract year from tag (e.g., gatecse-2023 -> 2023)
            // Or check if question matches specifically selected "gatecse-YYYY" tags
            let yearMatch = true;

            const qYearTag = q.tags.find(t => t.startsWith("gate"));
            const qYearNum = qYearTag ? parseInt(qYearTag.match(/\d{4}/)?.[0] || "0", 10) : 0;

            if (selectedYears.length > 0) {
                yearMatch = selectedYears.includes(qYearTag);
            }

            // 2. Year Range
            let rangeMatch = true;
            if (yearRange && yearRange.length === 2) {
                rangeMatch = qYearNum >= yearRange[0] && qYearNum <= yearRange[1];
            }

            // 3. Topic Filter
            // Question matches if it has ANY of the selected topics
            // Now using strict hierarchy: selectedTopics contains "Display Names" (e.g. "Operating System")
            // Question tags are like "operating-system".
            // We need to check if any of the question's tags map to the selected topics.
            // QuestionService has the logic, but here we can just normalize and check.
            // Actually, let's normalize the selected topic to check against question tags.
            let topicMatch = true;
            if (selectedTopics.length > 0) {
                // We need to see if this question belongs to any of the selected topics.
                // A question belongs to a topic if ANY of its tags is a subtopic of that topic.
                // OR if it has a tag that matches the topic name itself.

                // Let's iterate selected topics, for each, check if question has a matching tag.
                // Optimization: Prepare a Set of normalized acceptable tags for the selected topics?
                // Or just simple check:
                topicMatch = selectedTopics.some(selectedTopic => {
                    // Get all valid subtopics for this topic from QuestionService
                    const validSubtopics = QuestionService.TOPIC_HIERARCHY[selectedTopic] || [];
                    // Check if question has any tag that matches these subtopics OR the topic itself
                    return q.tags.some(tag => {
                        const normTag = QuestionService.normalizeString(tag);
                        if (normTag === QuestionService.normalizeString(selectedTopic)) return true;
                        return validSubtopics.some(sub => QuestionService.normalizeString(sub) === normTag);
                    });
                });
            }

            // 4. Subtopic Filter
            // selectedSubtopics contains "Display Names" (e.g. "Paging")
            let subtopicMatch = true;
            if (selectedSubtopics.length > 0) {
                subtopicMatch = q.tags.some(tag => {
                    const normTag = QuestionService.normalizeString(tag);
                    return selectedSubtopics.some(sub => QuestionService.normalizeString(sub) === normTag);
                });
            }

            return yearMatch && rangeMatch && topicMatch && subtopicMatch;
        });

        setFilteredQuestions(result);

    }, [filters, isInitialized]);

    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => {
            const merged = { ...prev, ...newFilters };
            if (Object.prototype.hasOwnProperty.call(newFilters, 'selectedTypes')) {
                merged.selectedTypes = normalizeSelectedTypes(newFilters.selectedTypes);
            }
            return merged;
        });
    }, []);

    const clearFilters = useCallback(() => {
        const { minYear, maxYear } = structuredTags;
        setFilters({
            selectedYears: [],
            yearRange: [minYear, maxYear],
            selectedTopics: [],
            selectedSubtopics: [],
            selectedTypes: [...DEFAULT_SELECTED_TYPES],
            searchQuery: ""
        });
    }, [structuredTags]);

    return (
        <FilterContext.Provider value={{
            filters,
            updateFilters,
            clearFilters,
            filteredQuestions,
            structuredTags,
            totalQuestions,
            isInitialized
        }}>
            {children}
        </FilterContext.Provider>
    );
};
