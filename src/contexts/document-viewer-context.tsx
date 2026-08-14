import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  DocumentViewerState,
  DocumentViewerContextValue,
  Document,
  FetchDocumentFn,
  LoadDocumentOptions
} from '@types';
import { normalizeLoadDocumentArgs } from '@utils/load-document-options';

// Initial state for the context
const initialState: DocumentViewerState = {
  document: null,
  isLoading: false,
  isOpen: false,
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

  const setDocument = useCallback((document: Document | null) => {
    setState(prev => ({ ...prev, document }));
  }, []);

  const setFetchDocumentFn = useCallback((fn: FetchDocumentFn) => {
    fetchDocumentFnRef.current = fn;
  }, []);

  const openViewer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  const closeViewer = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      document: null,
      pageNumber: undefined,
      citationSnippet: undefined,
      citationMatchIndex: undefined
    }));
  }, []);

  const loadDocument = useCallback(async (
    documentId: string,
    pageNumberOrOptions?: number | LoadDocumentOptions,
    citationSnippet?: string,
    legacyElementId?: string
  ) => {
    const { page, snippet, matchIndex } = normalizeLoadDocumentArgs(
      pageNumberOrOptions,
      citationSnippet,
      legacyElementId
    );
    setState(prev => ({
      ...prev,
      isLoading: true,
      document: null,
      isOpen: true,
      pageNumber: page,
      citationSnippet: snippet,
      citationMatchIndex: matchIndex
    }));
    const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
    if (!fetchFn) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('No fetchDocumentFn provided. Cannot load document.');
    }
    try {
      const response = await fetchFn(documentId);
      const documentWithId = { ...response, documentId };
      setState(prev => ({
        ...prev,
        document: documentWithId,
        isLoading: false
      }));
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [providedFetchFn]);

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
    loadDocument,
    setFetchDocumentFn,
    openViewer,
    closeViewer,
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