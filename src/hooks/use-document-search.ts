import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentSearchController, DocumentSearchMatchesCount } from '@types';

const EMPTY_MATCHES_COUNT: DocumentSearchMatchesCount = { current: 0, total: 0 };

// Mirror of pdfjs-dist's FindState enum, which lives in the viewer module that
// DocumentViewer only imports dynamically in the browser.
const FIND_STATE_NOT_FOUND = 1;
const FIND_STATE_PENDING = 3;

interface FindOverrides {
  query?: string;
  findPrevious?: boolean;
}

/**
 * Drives PDF.js's own PDFFindController over the viewer's event bus, so matching
 * and highlighting use the text layer PDF.js already renders.
 */
const useDocumentSearch = (eventBus: any): DocumentSearchController => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchesCount, setMatchesCount] = useState(EMPTY_MATCHES_COUNT);
  const [findState, setFindState] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const isOpenRef = useRef(false);
  const queryRef = useRef('');

  const dispatchFind = useCallback(
    (type: string, overrides?: FindOverrides) => {
      if (!eventBus) return;

      const nextQuery = overrides?.query ?? queryRef.current;
      if (!nextQuery) {
        setMatchesCount(EMPTY_MATCHES_COUNT);
        setFindState(null);
        eventBus.dispatch('findbarclose', { source: null });
        return;
      }

      eventBus.dispatch('find', {
        source: null,
        type,
        query: nextQuery,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: overrides?.findPrevious ?? false,
        matchDiacritics: false
      });
    },
    [eventBus]
  );

  useEffect(() => {
    if (!eventBus) return;

    const handleMatchesCount = (event: any) => {
      setMatchesCount(event?.matchesCount ?? EMPTY_MATCHES_COUNT);
    };

    const handleControlState = (event: any) => {
      setFindState(typeof event?.state === 'number' ? event.state : null);
      if (event?.matchesCount) {
        setMatchesCount(event.matchesCount);
      }
    };

    eventBus.on('updatefindmatchescount', handleMatchesCount);
    eventBus.on('updatefindcontrolstate', handleControlState);

    return () => {
      eventBus.off('updatefindmatchescount', handleMatchesCount);
      eventBus.off('updatefindcontrolstate', handleControlState);
    };
  }, [eventBus]);

  // Each loaded document gets a fresh event bus, so previous counts no longer
  // describe what is on screen; re-run an active query against the new document.
  useEffect(() => {
    setMatchesCount(EMPTY_MATCHES_COUNT);
    setFindState(null);

    if (eventBus && isOpenRef.current && queryRef.current) {
      dispatchFind('');
    }
  }, [eventBus, dispatchFind]);

  const open = useCallback(() => {
    isOpenRef.current = true;
    setIsOpen(true);
    setFocusToken((token) => token + 1);

    // Closing tells PDF.js to drop its highlights, so reopening has to search again.
    if (queryRef.current) {
      dispatchFind('');
    }
  }, [dispatchFind]);

  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    setMatchesCount(EMPTY_MATCHES_COUNT);
    setFindState(null);
    eventBus?.dispatch('findbarclose', { source: null });
  }, [eventBus]);

  const changeQuery = useCallback(
    (nextQuery: string) => {
      queryRef.current = nextQuery;
      setQuery(nextQuery);
      dispatchFind('', { query: nextQuery });
    },
    [dispatchFind]
  );

  const findNext = useCallback(() => {
    dispatchFind('again', { findPrevious: false });
  }, [dispatchFind]);

  const findPrevious = useCallback(() => {
    dispatchFind('again', { findPrevious: true });
  }, [dispatchFind]);

  return {
    isOpen,
    query,
    matchesCount,
    isPending: findState === FIND_STATE_PENDING,
    isNotFound: findState === FIND_STATE_NOT_FOUND,
    focusToken,
    open,
    close,
    setQuery: changeQuery,
    findNext,
    findPrevious
  };
};

export default useDocumentSearch;
