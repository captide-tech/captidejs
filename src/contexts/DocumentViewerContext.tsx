import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  DocumentViewerState, 
  DocumentViewerContextValue, 
  SourceDocument,
  FetchDocumentFn
} from '../types';

// Initial state for the context
const initialState: DocumentViewerState = {
  document: null,
  sourceType: null,
  highlightedElementId: null,
  isLoading: false
};

// Create context with a meaningful initial undefined value to detect improper usage
const DocumentViewerContext = createContext<DocumentViewerContextValue | undefined>(undefined);

// Name for debugging purposes
DocumentViewerContext.displayName = 'DocumentViewerContext';

// Props for the DocumentViewerProvider
interface DocumentViewerProviderProps {
  children: React.ReactNode;
  fetchDocumentFn?: FetchDocumentFn;
}

/**
 * Provider component for DocumentViewer state management
 * 
 * This component manages document viewing state and provides methods for loading and
 * interacting with documents. Documents are only loaded when explicitly requested through
 * the loadDocument method, never automatically.
 */
export const DocumentViewerProvider: React.FC<DocumentViewerProviderProps> = ({ 
  children,
  fetchDocumentFn: providedFetchFn
}) => {
  // State for the DocumentViewer
  const [state, setState] = useState<DocumentViewerState>(initialState);
  
  // Use a ref instead of state for the fetch function to prevent unnecessary re-renders
  // and to avoid any potential issues during initialization
  const fetchDocumentFnRef = useRef<FetchDocumentFn | null>(null);
  
  // Set the fetch function ref when provided
  useEffect(() => {
    if (providedFetchFn) {
      fetchDocumentFnRef.current = providedFetchFn;
    }
  }, [providedFetchFn]);

  /**
   * Updates the DocumentViewer state
   */
  const updateDocumentViewer = useCallback((updates: Partial<DocumentViewerState>) => {
    setState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  /**
   * Sets the document and source type
   */
  const setDocument = useCallback((document: SourceDocument | null) => {
    updateDocumentViewer({
      document,
      sourceType: document?.sourceType || null,
      isLoading: false
    });
  }, [updateDocumentViewer]);

  /**
   * Highlights an element in the current document
   */
  const highlightElement = useCallback((elementId: string) => {
    // Validate element ID format
    if (elementId && !elementId.startsWith('#')) {
      throw new Error('Element ID must start with # - received: ' + elementId);
    }
    
    if (elementId && elementId.replace('#', '').length !== 8) {
      throw new Error('Element ID must be 8 characters long (excluding #) - received: ' + elementId);
    }

    updateDocumentViewer({ highlightedElementId: elementId });
  }, [updateDocumentViewer]);

  /**
   * Sets the fetch document function
   */
  const setFetchDocumentFn = useCallback((fn: FetchDocumentFn) => {
    fetchDocumentFnRef.current = fn;
  }, []);

  /**
   * Loads a document and optionally highlights an element
   * This will only be called when explicitly invoked by user code,
   * never automatically during initialization.
   */
  const loadDocument = useCallback(async (sourceLink: string, elementId?: string) => {
    // Validate sourceLink
    if (!sourceLink || typeof sourceLink !== 'string' || sourceLink.trim() === '') {
      throw new Error(
        'Invalid sourceLink: sourceLink must be a non-empty string.'
      );
    }

    // Ensure we have a fetch function
    if (!fetchDocumentFnRef.current) {
      throw new Error(
        'No fetchDocumentFn provided. Use setFetchDocumentFn to set a function for fetching documents.'
      );
    }

    // Start loading
    updateDocumentViewer({ isLoading: true });

    try {
      // Fetch the document using the consumer-provided function
      const document = await fetchDocumentFnRef.current(sourceLink);
      
      // Ensure sourceLink is set on the document
      const documentWithSourceLink: SourceDocument = {
        ...document,
        sourceLink
      };

      // Update state with the document
      setDocument(documentWithSourceLink);

      // Set the highlight if provided
      if (elementId) {
        highlightElement(elementId);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      updateDocumentViewer({ 
        isLoading: false,
        document: null,
        sourceType: null
      });
      throw error;
    }
  }, [setDocument, highlightElement, updateDocumentViewer]);

  // Create the context value object
  const contextValue: DocumentViewerContextValue = {
    ...state,
    updateDocumentViewer,
    setDocument,
    highlightElement,
    loadDocument,
    setFetchDocumentFn
  };

  return (
    <DocumentViewerContext.Provider value={contextValue}>
      {children}
    </DocumentViewerContext.Provider>
  );
};

/**
 * Hook for accessing the DocumentViewer context
 * 
 * @throws {Error} If used outside of a DocumentViewerProvider
 */
export const useDocumentViewer = (): DocumentViewerContextValue => {
  const context = useContext(DocumentViewerContext);
  
  if (context === undefined) {
    throw new Error(
      'useDocumentViewer must be used within a DocumentViewerProvider. ' +
      'Make sure you have wrapped your application or component with <DocumentViewerProvider>.</DocumentViewerProvider>'
    );
  }
  
  return context;
}; 