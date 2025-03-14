import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  DocumentViewerState, 
  DocumentViewerContextValue, 
  SourceDocument,
  FetchDocumentFn,
  SourceDocumentBase,
  TabInfo,
  SourceType
} from '../types';

// Initial state for the context
const initialState: DocumentViewerState = {
  document: null,
  highlightedElementId: null,
  isLoading: false,
  isOpen: false,
  tabs: []
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
 * Extract source type from a sourceLink URL
 * 
 * @param sourceLink - The source link containing the source_type parameter
 * @returns The source type value
 * @throws Error if the sourceLink cannot be parsed or lacks a valid source_type
 */
function extractSourceTypeFromUrl(sourceLink: string): SourceType {
  try {
    const url = new URL(sourceLink);
    const sourceTypeParam = url.searchParams.get('source_type');
    
    // Check if the sourceTypeParam is one of the valid SourceType values
    if (sourceTypeParam === '10-K' || 
        sourceTypeParam === '10-Q' || 
        sourceTypeParam === '8-K' || 
        sourceTypeParam === 'transcript') {
      return sourceTypeParam;
    }
    
    // Throw an error if source_type is missing or invalid
    throw new Error(`Invalid source_type parameter in sourceLink: ${sourceTypeParam || 'missing'}`);
  } catch (e) {
    // Add more context to the error
    const error = e instanceof Error ? e : new Error(String(e));
    throw new Error(`Failed to parse sourceLink URL for determining sourceType: ${sourceLink}. ${error.message}`);
  }
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
    // Use a function to update state based on previous state
    // This ensures we're always working with the latest state
    setState(prev => {
      const newState = {
        ...prev,
        ...updates
      };
      return newState;
    });
  }, []);

  /**
   * Sets the document
   */
  const setDocument = useCallback((document: SourceDocument | null) => {
    // Update document state in a single atomic update
    updateDocumentViewer({
      document,
      isLoading: false,
      highlightedElementId: document?.highlightedElementId || null
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
    
    // Also update the document with the highlightedElementId if it exists
    if (state.document) {
      setDocument({
        ...state.document,
        highlightedElementId: elementId
      });
    }
  }, [updateDocumentViewer, setDocument, state.document]);

  /**
   * Sets the fetch document function
   */
  const setFetchDocumentFn = useCallback((fn: FetchDocumentFn) => {
    fetchDocumentFnRef.current = fn;
  }, []);

  /**
   * Open the document viewer
   */
  const openViewer = useCallback(() => {
    updateDocumentViewer({ isOpen: true });
  }, [updateDocumentViewer]);

  /**
   * Close the document viewer
   */
  const closeViewer = useCallback(() => {
    updateDocumentViewer({ 
      isOpen: false,
      document: null,
      highlightedElementId: null
    });
  }, [updateDocumentViewer]);

  /**
   * Loads a document and optionally highlights an element
   * This will only be called when explicitly invoked by user code,
   * never automatically during initialization.
   */
  const loadDocument: (sourceLink: string, elementId?: string) => Promise<void> = useCallback(async (sourceLink: string, elementId?: string) => {
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

    // Open the viewer if it's not already open
    if (!state.isOpen) {
      openViewer();
    }

    // Check if a tab already exists for this document
    const existingTabIndex = state.tabs.findIndex(tab => tab.sourceLink === sourceLink);
    let updatedTabs = [...state.tabs];
    
    if (existingTabIndex === -1) {
      // If no tab exists, create a new one
      try {
        // Extract the sourceType from the URL
        const sourceType = extractSourceTypeFromUrl(sourceLink);
        
        // Create a new tab with the extracted source type
        const newTab: TabInfo = {
          sourceLink,
          sourceType,
          ticker: null,
          fiscalPeriod: null,
          isLoading: true
        };
        
        // Add the new tab to the front
        updatedTabs.unshift(newTab);
      } catch (error) {
        console.error('Failed to create tab:', error);
        
        // Create a fallback tab with best guess for source type
        const sourceTypeGuess: SourceType = sourceLink.includes('transcript') ? 'transcript' : '10-K';
        
        const fallbackTab: TabInfo = {
          sourceLink,
          sourceType: sourceTypeGuess,
          ticker: 'Unknown',
          fiscalPeriod: '',
          isLoading: true
        };
        
        // Add the fallback tab to the front
        updatedTabs.unshift(fallbackTab);
      }
    } else {
      // If the tab exists, mark it as loading
      updatedTabs = updatedTabs.map(tab => {
        if (tab.sourceLink === sourceLink) {
          return { ...tab, isLoading: true };
        }
        return tab;
      });
      
      // Move the tab to the front
      const existingTab = updatedTabs[existingTabIndex];
      updatedTabs.splice(existingTabIndex, 1);
      updatedTabs.unshift(existingTab);
    }
    
    // Set loading state and update tabs
    updateDocumentViewer({ 
      tabs: updatedTabs, 
      isLoading: true,
      // Clear current document to avoid any state conflicts
      document: null 
    });

    try {
      // Fetch the document using the consumer-provided function
      const document = await fetchDocumentFnRef.current(sourceLink);
      
      // Ensure sourceLink is set on the document
      const documentWithSourceLink: SourceDocument = {
        ...document,
        sourceLink,
        highlightedElementId: elementId || null
      };
      
      // Update the tab info with the loaded document data
      const updatedTabsAfterLoad = updatedTabs.map(tab => {
        if (tab.sourceLink === sourceLink) {
          return {
            ...tab,
            sourceType: documentWithSourceLink.sourceType,
            ticker: documentWithSourceLink.ticker,
            fiscalPeriod: documentWithSourceLink.fiscalPeriod,
            isLoading: false
          };
        }
        return tab;
      });
      
      // CRITICAL: Update everything in a single state update to avoid race conditions
      // This ensures the document and tabs are updated atomically
      updateDocumentViewer({ 
        document: documentWithSourceLink,
        tabs: updatedTabsAfterLoad, 
        isLoading: false,
        highlightedElementId: elementId || null 
      });

      // No need to call highlightElement separately, as we've already set the highlightedElementId
    } catch (error) {
      console.error('Failed to load document:', error);
      
      // Update the tab to show it's no longer loading
      const updatedTabsAfterError = updatedTabs.map(tab => {
        if (tab.sourceLink === sourceLink) {
          return { ...tab, isLoading: false };
        }
        return tab;
      });
      
      updateDocumentViewer({ 
        isLoading: false,
        document: null,
        highlightedElementId: null,
        tabs: updatedTabsAfterError
      });
      
      throw error;
    }
  }, [state.tabs, state.isOpen, updateDocumentViewer, openViewer]);

  /**
   * Add a new tab or switch to existing tab
   */
  const selectTab = useCallback((sourceLink: string) => {
    // Validate sourceLink
    if (!sourceLink || typeof sourceLink !== 'string' || sourceLink.trim() === '') {
      throw new Error('Cannot select tab: sourceLink must be a non-empty string');
    }

    // Get the current tabs
    const currentTabs = [...state.tabs];
    
    // Check if the tab already exists
    const existingTabIndex = currentTabs.findIndex(tab => tab.sourceLink === sourceLink);
    
    if (existingTabIndex !== -1) {
      // If the tab exists, move it to the front
      const existingTab = currentTabs[existingTabIndex];
      
      // Remove the tab from its current position
      currentTabs.splice(existingTabIndex, 1);
      
      // Add it to the front
      currentTabs.unshift(existingTab);
      
      // Update the state with tabs first
      updateDocumentViewer({ tabs: currentTabs });
      
      // If there's a document associated with this tab, load it
      if (state.document && state.document.sourceLink === sourceLink) {
        return; // Already showing this document
      }
      
      // Otherwise, load the document (using function reference rather than direct call)
      updateDocumentViewer({ isLoading: true });
      fetchDocumentFnRef.current?.(sourceLink)
        .then(document => {
          // Ensure sourceLink is set on the document
          const documentWithSourceLink: SourceDocument = {
            ...document,
            sourceLink,
            highlightedElementId: null
          };
          
          // IMPORTANT: Set document first, then update tabs to ensure correct tab selection
          setDocument(documentWithSourceLink);
          
          // Update the tab info with the loaded document data
          const updatedTabs = currentTabs.map(tab => {
            if (tab.sourceLink === sourceLink) {
              return {
                ...tab,
                sourceType: documentWithSourceLink.sourceType,
                ticker: documentWithSourceLink.ticker,
                fiscalPeriod: documentWithSourceLink.fiscalPeriod,
                isLoading: false
              };
            }
            return tab;
          });
          
          updateDocumentViewer({ tabs: updatedTabs, isLoading: false });
        })
        .catch(error => {
          console.error('Failed to load document:', error);
          updateDocumentViewer({ isLoading: false });
        });
      
      return;
    }
    
    // If the tab doesn't exist, create a new one
    try {
      // Extract the sourceType from the URL
      const sourceType = extractSourceTypeFromUrl(sourceLink);
      
      // Create a new tab with the extracted source type
      const newTab: TabInfo = {
        sourceLink,
        sourceType,
        ticker: null,
        fiscalPeriod: null,
        isLoading: true
      };
      
      // Add the new tab to the front
      currentTabs.unshift(newTab);
      
      // Update the state
      updateDocumentViewer({ tabs: currentTabs, isLoading: true });
      
      // Load the document (using function reference rather than direct call)
      fetchDocumentFnRef.current?.(sourceLink)
        .then(document => {
          // Ensure sourceLink is set on the document
          const documentWithSourceLink: SourceDocument = {
            ...document,
            sourceLink,
            highlightedElementId: null
          };
          
          // IMPORTANT: Set document first to ensure correct tab selection
          setDocument(documentWithSourceLink);
          
          // Update the tab info with the loaded document data
          const updatedTabs = currentTabs.map(tab => {
            if (tab.sourceLink === sourceLink) {
              return {
                ...tab,
                sourceType: documentWithSourceLink.sourceType,
                ticker: documentWithSourceLink.ticker,
                fiscalPeriod: documentWithSourceLink.fiscalPeriod,
                isLoading: false
              };
            }
            return tab;
          });
          
          updateDocumentViewer({ tabs: updatedTabs, isLoading: false });
        })
        .catch(error => {
          console.error('Failed to load document:', error);
          
          // Update the tab to show it's no longer loading
          const updatedTabs = currentTabs.map(tab => {
            if (tab.sourceLink === sourceLink) {
              return { ...tab, isLoading: false };
            }
            return tab;
          });
          
          updateDocumentViewer({ 
            isLoading: false,
            tabs: updatedTabs
          });
        });
    } catch (error) {
      console.error('Failed to create tab:', error);
      
      // Show error to the user (you might want to add a toast notification or error state in the UI)
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Even with an error, we should add the tab but mark it as having an error
      // This provides better UX by showing the user there was a problem with this tab
      const sourceTypeGuess: SourceType = sourceLink.includes('transcript') ? 'transcript' : '10-K';
      
      const errorTab: TabInfo = {
        sourceLink,
        sourceType: sourceTypeGuess, // Best guess based on URL
        ticker: 'ERROR',
        fiscalPeriod: 'Failed to parse URL',
        isLoading: false
      };
      
      // Add the error tab to the front
      currentTabs.unshift(errorTab);
      
      // Update the state
      updateDocumentViewer({ tabs: currentTabs });
      
      // Rethrow the error to be handled by the caller
      throw new Error(`Failed to select tab: ${errorMessage}`);
    }
  }, [state.tabs, state.document, updateDocumentViewer, setDocument]);

  /**
   * Close a tab
   */
  const closeTab = useCallback((sourceLink: string) => {
    // Get the current tabs
    const currentTabs = [...state.tabs];
    
    // Remove the tab with the given sourceLink
    const newTabs = currentTabs.filter(tab => tab.sourceLink !== sourceLink);
    
    // If we're closing the current document, we need to load a different one
    // or clear the document if there are no tabs left
    const isCurrentDocument = state.document && state.document.sourceLink === sourceLink;
    
    if (isCurrentDocument) {
      if (newTabs.length === 0) {
        // If there are no tabs left, clear the document
        updateDocumentViewer({
          tabs: newTabs,
          document: null,
          highlightedElementId: null
        });
      } else {
        // Otherwise, load the first tab
        updateDocumentViewer({
          tabs: newTabs,
          isLoading: true
        });
        
        // Load the document for the first tab
        loadDocument(newTabs[0].sourceLink);
      }
    } else {
      // Just update the tabs
      updateDocumentViewer({ tabs: newTabs });
    }
  }, [state.tabs, state.document, updateDocumentViewer]);

  // Create the context value object
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
    closeTab
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