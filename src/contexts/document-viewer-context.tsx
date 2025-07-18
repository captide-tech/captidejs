import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  DocumentViewerState,
  DocumentViewerContextValue,
  Document,
  TabInfo,
  FetchDocumentFn
} from '@types';

// Initial state for the context
const initialState: DocumentViewerState = {
  document: null,
  highlightedElementId: null,
  citationSnippet: null,
  isLoading: false,
  isOpen: false,
  tabs: [],
  zoomLevel: 0.7
};

const DocumentViewerContext = createContext<DocumentViewerContextValue | undefined>(undefined);
DocumentViewerContext.displayName = 'DocumentViewerContext';

interface DocumentViewerProviderProps {
  children: React.ReactNode;
  fetchDocumentFn?: FetchDocumentFn;
}

export const DocumentViewerProvider: React.FC<DocumentViewerProviderProps> = ({
  children,
  fetchDocumentFn: providedFetchFn
}) => {
  const [state, setState] = useState<DocumentViewerState>(initialState);
  const fetchDocumentFnRef = useRef<FetchDocumentFn | null>(null);

  useEffect(() => {
    if (providedFetchFn) {
      fetchDocumentFnRef.current = providedFetchFn;
    }
  }, [providedFetchFn]);

  const updateDocumentViewer = useCallback((updates: Partial<DocumentViewerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setDocument = useCallback((document: any | null) => {
    setState(prev => ({ ...prev, document }));
  }, []);

  const setFetchDocumentFn = useCallback((fn: FetchDocumentFn) => {
    fetchDocumentFnRef.current = fn;
  }, []);

  const openViewer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  const closeViewer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, document: null, highlightedElementId: null, citationSnippet: null }));
  }, []);

  const highlightElement = useCallback((elementId: string) => {
    setState(prev => ({ ...prev, highlightedElementId: elementId }));
  }, []);

  const loadDocument = useCallback(async (sourceLink: string, id?: string, citationSnippet?: string) => {
    setState(prev => ({ ...prev, isLoading: true, document: null, isOpen: true }));
    const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
    if (!fetchFn) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('No fetchDocumentFn provided. Cannot load document.');
    }
    try {
      const response = await fetchFn(sourceLink);
      setState(prev => ({
        ...prev,
        document: response,
        isLoading: false,
        highlightedElementId: id || null,
        citationSnippet: citationSnippet || null
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, document: null, highlightedElementId: null, citationSnippet: null }));
      throw error;
    }
  }, [providedFetchFn]);

  const selectTab = useCallback((id: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Cannot select tab: id must be a non-empty string');
    }
    const currentTabs = [...state.tabs];
    const existingTabIndex = currentTabs.findIndex(tab => tab.id === id);
    if (existingTabIndex !== -1) {
      if (state.document && state.document.id === id) {
        return;
      }
      updateDocumentViewer({ isLoading: true });
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (!fetchFn) {
        updateDocumentViewer({ isLoading: false });
        throw new Error('No fetchDocumentFn provided. Cannot load document for the selected tab.');
      }
      fetchFn(id)
        .then(response => {
          setDocument(response);
          const updatedTabs = currentTabs.map(tab =>
            tab.id === id ? { ...tab, ...response, isLoading: false } : tab
          );
          updateDocumentViewer({ tabs: updatedTabs, isLoading: false });
        })
        .catch(() => {
          updateDocumentViewer({ isLoading: false });
        });
      return;
    }
    // If the tab doesn't exist, create a new one and place it at the front
    try {
      const newTab: TabInfo = {
        id,
        documentCategory: '',
        originalFileUrl: '',
        markdownFileUrl: '',
        metadata: {},
        isLoading: true
      };
      currentTabs.unshift(newTab);
      updateDocumentViewer({ tabs: currentTabs, isLoading: true });
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (!fetchFn) {
        updateDocumentViewer({ isLoading: false });
        throw new Error('No fetchDocumentFn provided. Cannot load document for the new tab.');
      }
      fetchFn(id)
        .then(response => {
          setDocument(response);
          const updatedTabs = currentTabs.map(tab =>
            tab.id === id ? { ...tab, ...response, isLoading: false } : tab
          );
          updateDocumentViewer({ tabs: updatedTabs, isLoading: false });
        })
        .catch(() => {
          const updatedTabs = currentTabs.map(tab =>
            tab.id === id ? { ...tab, isLoading: false } : tab
          );
          updateDocumentViewer({ isLoading: false, tabs: updatedTabs });
        });
    } catch (error) {
      const errorTab: TabInfo = {
        id,
        documentCategory: '',
        originalFileUrl: '',
        markdownFileUrl: '',
        metadata: {},
        isLoading: false
      };
      currentTabs.unshift(errorTab);
      updateDocumentViewer({ tabs: currentTabs, isLoading: false });
    }
  }, [state.tabs, state.document, updateDocumentViewer, providedFetchFn, setDocument]);

  const closeTab = useCallback((id: string) => {
    const updatedTabs = state.tabs.filter(tab => tab.id !== id);
    updateDocumentViewer({ tabs: updatedTabs });
    if (state.document && state.document.id === id) {
      setDocument(null);
    }
  }, [state.tabs, state.document, updateDocumentViewer, setDocument]);

  const setZoomLevel = useCallback((level: number) => {
    setState(prev => ({ ...prev, zoomLevel: level }));
  }, []);
  const zoomIn = useCallback(() => {
    setState(prev => ({ ...prev, zoomLevel: prev.zoomLevel + 0.1 }));
  }, []);
  const zoomOut = useCallback(() => {
    setState(prev => ({ ...prev, zoomLevel: Math.max(0.1, prev.zoomLevel - 0.1) }));
  }, []);
  const resetZoom = useCallback(() => {
    setState(prev => ({ ...prev, zoomLevel: 1.0 }));
  }, []);

  const contextValue: DocumentViewerContextValue = {
    ...state,
    updateDocumentViewer,
    setDocument,
    highlightElement,
    loadDocument,
    setFetchDocumentFn,
    openViewer,
    closeViewer,
    selectTab,
    closeTab,
    setZoomLevel,
    zoomIn,
    zoomOut,
    resetZoom
  };

  return (
    <DocumentViewerContext.Provider value={contextValue}>
      {children}
    </DocumentViewerContext.Provider>
  );
};

export const useDocumentViewer = (): DocumentViewerContextValue => {
  const context = useContext(DocumentViewerContext);
  if (!context) {
    throw new Error('useDocumentViewer must be used within a DocumentViewerProvider');
  }
  return context;
}; 