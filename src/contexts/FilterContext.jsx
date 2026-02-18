import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { QuestionService } from '../services/QuestionService';
import { AnswerService } from '../services/AnswerService';

const FilterContext = createContext();

const DEFAULT_SELECTED_TYPES = ['MCQ', 'MSQ', 'NAT'];
const STORAGE_KEYS = {
    solved: 'gate_qa_solved_questions',
    bookmarked: 'gate_qa_bookmarked_questions',
    metadata: 'gate_qa_progress_metadata'
};
const LEGACY_STORAGE_KEYS = {
    bookmarked: 'gateqa_bookmarks_v1'
};
const STORAGE_HEALTH_KEY = '__gate_qa_storage_health_check__';

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

const normalizeStoredIds = (rawIds) => {
    if (!Array.isArray(rawIds)) {
        return [];
    }

    const seen = new Set();
    const normalized = [];

    rawIds.forEach((rawId) => {
        const id = String(rawId || '').trim();
        if (!id || seen.has(id)) {
            return;
        }
        seen.add(id);
        normalized.push(id);
    });

    return normalized;
};

const parseBooleanParam = (value) => {
    if (typeof value !== 'string') {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const canUseBrowserStorage = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        window.localStorage.setItem(STORAGE_HEALTH_KEY, 'ok');
        window.localStorage.removeItem(STORAGE_HEALTH_KEY);
        return true;
    } catch (error) {
        return false;
    }
};

const readJsonFromStorage = (key, fallback) => {
    if (typeof window === 'undefined') {
        return fallback;
    }
    try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
};

const getQuestionTrackingId = (question = {}) => {
    if (!question || typeof question !== 'object') {
        return null;
    }

    const candidate = AnswerService.getStorageKeyForQuestion(question);
    if (!candidate) {
        return null;
    }

    const normalized = String(candidate).trim();
    return normalized || null;
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
        selectedTypes: [...DEFAULT_SELECTED_TYPES],
        hideSolved: false,
        showOnlySolved: false,
        showOnlyBookmarked: false,
        searchQuery: ''
    });

    const [filteredQuestions, setFilteredQuestions] = useState([]);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    const [solvedQuestionIds, setSolvedQuestionIds] = useState([]);
    const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState([]);
    const [isProgressStorageAvailable, setIsProgressStorageAvailable] = useState(true);
    const [hasLoadedProgressState, setHasLoadedProgressState] = useState(false);

    useEffect(() => {
        if (QuestionService.questions.length > 0) {
            const tags = QuestionService.getStructuredTags();
            setStructuredTags(tags);
            setTotalQuestions(QuestionService.questions.length);

            const { minYear, maxYear } = tags;
            setFilters(prev => ({
                ...prev,
                yearRange: [minYear, maxYear]
            }));

            setIsInitialized(true);
        }
    }, [QuestionService.loaded]);

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
                : normalizeSelectedTypes(urlTypes.split(',').filter(Boolean)),
            hideSolved: parseBooleanParam(params.get('hideSolved')),
            showOnlySolved: parseBooleanParam(params.get('showOnlySolved')),
            showOnlyBookmarked: parseBooleanParam(params.get('showOnlyBookmarked'))
        };

        if (urlFilters.yearRange && urlFilters.yearRange.length === 2 && !isNaN(urlFilters.yearRange[0])) {
            setFilters(prev => ({ ...prev, ...urlFilters }));
        } else {
            const { yearRange, ...rest } = urlFilters;
            setFilters(prev => ({ ...prev, ...rest }));
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) return;

        // Preserve any existing `question` param set by App.jsx deep-linking
        const existingParams = new URLSearchParams(window.location.search);
        const questionParam = existingParams.get('question');

        const params = new URLSearchParams();
        if (filters.selectedYears.length) params.set('years', filters.selectedYears.join(','));
        if (filters.selectedTopics.length) params.set('topics', filters.selectedTopics.join(','));
        if (filters.selectedSubtopics.length) params.set('subtopics', filters.selectedSubtopics.join(','));
        if (filters.yearRange) params.set('range', filters.yearRange.join('-'));

        const selectedTypes = normalizeSelectedTypes(filters.selectedTypes);
        if (selectedTypes.length > 0 && selectedTypes.length < DEFAULT_SELECTED_TYPES.length) {
            params.set('types', selectedTypes.join(','));
        }

        if (filters.hideSolved) {
            params.set('hideSolved', '1');
        }
        if (filters.showOnlySolved) {
            params.set('showOnlySolved', '1');
        }
        if (filters.showOnlyBookmarked) {
            params.set('showOnlyBookmarked', '1');
        }

        // Re-attach the question param so deep-link is not wiped by filter sync
        if (questionParam) {
            params.set('question', questionParam);
        }

        const query = params.toString();
        const newUrl = query
            ? `${window.location.pathname}?${query}`
            : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }, [filters, isInitialized]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            setIsProgressStorageAvailable(false);
            setHasLoadedProgressState(true);
            return;
        }

        const storageAvailable = canUseBrowserStorage();
        setIsProgressStorageAvailable(storageAvailable);

        if (!storageAvailable) {
            setHasLoadedProgressState(true);
            return;
        }

        const storedSolved = normalizeStoredIds(readJsonFromStorage(STORAGE_KEYS.solved, []));
        const storedBookmarkedRaw = readJsonFromStorage(STORAGE_KEYS.bookmarked, null);
        const storedBookmarked = storedBookmarkedRaw === null
            ? normalizeStoredIds(readJsonFromStorage(LEGACY_STORAGE_KEYS.bookmarked, []))
            : normalizeStoredIds(storedBookmarkedRaw);

        setSolvedQuestionIds(storedSolved);
        setBookmarkedQuestionIds(storedBookmarked);

        if (storedBookmarkedRaw === null) {
            try {
                window.localStorage.setItem(STORAGE_KEYS.bookmarked, JSON.stringify(storedBookmarked));
            } catch (error) {
                setIsProgressStorageAvailable(false);
            }
        }

        setHasLoadedProgressState(true);
    }, []);

    useEffect(() => {
        if (!hasLoadedProgressState || !isProgressStorageAvailable || typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(STORAGE_KEYS.solved, JSON.stringify(solvedQuestionIds));
            window.localStorage.setItem(STORAGE_KEYS.bookmarked, JSON.stringify(bookmarkedQuestionIds));
            window.localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                solvedCount: solvedQuestionIds.length,
                bookmarkedCount: bookmarkedQuestionIds.length
            }));
        } catch (error) {
            setIsProgressStorageAvailable(false);
        }
    }, [solvedQuestionIds, bookmarkedQuestionIds, hasLoadedProgressState, isProgressStorageAvailable]);

    const validQuestionIdSet = useMemo(() => {
        if (!isInitialized || !QuestionService.questions.length) {
            return new Set();
        }

        return new Set(
            QuestionService.questions
                .map(question => getQuestionTrackingId(question))
                .filter(Boolean)
        );
    }, [isInitialized, totalQuestions]);

    useEffect(() => {
        if (!isInitialized || validQuestionIdSet.size === 0) {
            return;
        }

        setSolvedQuestionIds((prev) => {
            const next = prev.filter(id => validQuestionIdSet.has(id));
            return next.length === prev.length ? prev : next;
        });

        setBookmarkedQuestionIds((prev) => {
            const next = prev.filter(id => validQuestionIdSet.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [isInitialized, validQuestionIdSet]);

    const solvedQuestionSet = useMemo(() => new Set(solvedQuestionIds), [solvedQuestionIds]);
    const bookmarkedQuestionSet = useMemo(() => new Set(bookmarkedQuestionIds), [bookmarkedQuestionIds]);

    useEffect(() => {
        if (!QuestionService.questions.length) return;

        const {
            selectedYears,
            selectedTopics,
            selectedSubtopics,
            yearRange,
            hideSolved,
            showOnlySolved,
            showOnlyBookmarked
        } = filters;

        const selectedTypes = normalizeSelectedTypes(filters.selectedTypes);
        const selectedTypeSet = new Set(selectedTypes.map(type => type.toUpperCase()));

        const result = QuestionService.questions.filter(q => {
            const questionId = getQuestionTrackingId(q);
            const isSolved = questionId ? solvedQuestionSet.has(questionId) : false;
            const isBookmarked = questionId ? bookmarkedQuestionSet.has(questionId) : false;

            if (hideSolved && isSolved) {
                return false;
            }

            if (showOnlySolved && !isSolved) {
                return false;
            }

            if (showOnlyBookmarked && !isBookmarked) {
                return false;
            }

            if (selectedTypes.length < DEFAULT_SELECTED_TYPES.length) {
                const answer = AnswerService.getAnswerForQuestion(q);
                const qType = answer ? answer.type : null;

                const normalizedQType = qType ? qType.toUpperCase() : '';
                const typeMatch = normalizedQType && selectedTypeSet.has(normalizedQType);

                if (!typeMatch) return false;
            }

            let yearMatch = true;
            const qYearTag = q.tags.find(t => t.startsWith('gate'));
            const qYearNum = qYearTag ? parseInt(qYearTag.match(/\d{4}/)?.[0] || '0', 10) : 0;

            if (selectedYears.length > 0) {
                yearMatch = selectedYears.includes(qYearTag);
            }

            let rangeMatch = true;
            if (yearRange && yearRange.length === 2) {
                rangeMatch = qYearNum >= yearRange[0] && qYearNum <= yearRange[1];
            }

            let topicMatch = true;
            if (selectedTopics.length > 0) {
                topicMatch = selectedTopics.some(selectedTopic => {
                    const validSubtopics = QuestionService.TOPIC_HIERARCHY[selectedTopic] || [];
                    return q.tags.some(tag => {
                        const normTag = QuestionService.normalizeString(tag);
                        if (normTag === QuestionService.normalizeString(selectedTopic)) return true;
                        return validSubtopics.some(sub => QuestionService.normalizeString(sub) === normTag);
                    });
                });
            }

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
    }, [filters, isInitialized, solvedQuestionSet, bookmarkedQuestionSet]);

    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => {
            const merged = { ...prev, ...newFilters };
            if (Object.prototype.hasOwnProperty.call(newFilters, 'selectedTypes')) {
                merged.selectedTypes = normalizeSelectedTypes(newFilters.selectedTypes);
            }
            return merged;
        });
    }, []);

    const toggleSolved = useCallback((questionOrId) => {
        const questionId = typeof questionOrId === 'string'
            ? String(questionOrId || '').trim()
            : getQuestionTrackingId(questionOrId);

        if (!questionId) {
            return;
        }

        setSolvedQuestionIds((prev) => (
            prev.includes(questionId)
                ? prev.filter(id => id !== questionId)
                : [...prev, questionId]
        ));
    }, []);

    const toggleBookmark = useCallback((questionOrId) => {
        const questionId = typeof questionOrId === 'string'
            ? String(questionOrId || '').trim()
            : getQuestionTrackingId(questionOrId);

        if (!questionId) {
            return;
        }

        setBookmarkedQuestionIds((prev) => (
            prev.includes(questionId)
                ? prev.filter(id => id !== questionId)
                : [...prev, questionId]
        ));
    }, []);

    const getQuestionProgressId = useCallback((question = {}) => {
        return getQuestionTrackingId(question);
    }, []);

    const isQuestionSolved = useCallback((questionOrId) => {
        const questionId = typeof questionOrId === 'string'
            ? String(questionOrId || '').trim()
            : getQuestionTrackingId(questionOrId);
        return questionId ? solvedQuestionSet.has(questionId) : false;
    }, [solvedQuestionSet]);

    const isQuestionBookmarked = useCallback((questionOrId) => {
        const questionId = typeof questionOrId === 'string'
            ? String(questionOrId || '').trim()
            : getQuestionTrackingId(questionOrId);
        return questionId ? bookmarkedQuestionSet.has(questionId) : false;
    }, [bookmarkedQuestionSet]);

    const setHideSolved = useCallback((value) => {
        const isHiding = !!value;
        const newFilters = { hideSolved: isHiding };
        if (isHiding) {
            newFilters.showOnlySolved = false;
        }
        updateFilters(newFilters);
    }, [updateFilters]);

    const setShowOnlySolved = useCallback((value) => {
        const isShowing = !!value;
        const newFilters = { showOnlySolved: isShowing };
        if (isShowing) {
            newFilters.hideSolved = false;
        }
        updateFilters(newFilters);
    }, [updateFilters]);

    const setShowOnlyBookmarked = useCallback((value) => {
        updateFilters({ showOnlyBookmarked: !!value });
    }, [updateFilters]);

    const solvedCount = useMemo(() => {
        if (validQuestionIdSet.size === 0) {
            return solvedQuestionIds.length;
        }
        return solvedQuestionIds.filter(id => validQuestionIdSet.has(id)).length;
    }, [solvedQuestionIds, validQuestionIdSet]);

    const bookmarkedCount = useMemo(() => {
        if (validQuestionIdSet.size === 0) {
            return bookmarkedQuestionIds.length;
        }
        return bookmarkedQuestionIds.filter(id => validQuestionIdSet.has(id)).length;
    }, [bookmarkedQuestionIds, validQuestionIdSet]);

    const progressPercentage = totalQuestions > 0
        ? Math.round((solvedCount / totalQuestions) * 100)
        : 0;

    const clearFilters = useCallback(() => {
        const { minYear, maxYear } = structuredTags;
        setFilters({
            selectedYears: [],
            yearRange: [minYear, maxYear],
            selectedTopics: [],
            selectedSubtopics: [],
            selectedTypes: [...DEFAULT_SELECTED_TYPES],
            hideSolved: false,
            showOnlySolved: false,
            showOnlyBookmarked: false,
            searchQuery: ''
        });
    }, [structuredTags]);

    // Expose all questions and a lookup helper for deep-linking
    const allQuestions = QuestionService.questions;

    const getQuestionById = useCallback((id) => {
        if (!id || typeof id !== 'string') return null;
        const trimmed = id.trim();
        if (!trimmed) return null;
        return allQuestions.find(q => q.question_uid === trimmed) || null;
    }, [allQuestions]);

    return (
        <FilterContext.Provider value={{
            filters,
            updateFilters,
            clearFilters,
            filteredQuestions,
            allQuestions,
            getQuestionById,
            structuredTags,
            totalQuestions,
            isInitialized,
            solvedQuestionIds,
            bookmarkedQuestionIds,
            solvedCount,
            bookmarkedCount,
            progressPercentage,
            isProgressStorageAvailable,
            toggleSolved,
            toggleBookmark,
            isQuestionSolved,
            isQuestionBookmarked,
            getQuestionProgressId,
            setHideSolved,
            setShowOnlySolved,
            setShowOnlyBookmarked
        }}>
            {children}
        </FilterContext.Provider>
    );
};
