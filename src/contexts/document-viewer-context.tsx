import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  DocumentViewerState,
  DocumentViewerContextValue,
  Document,
  TabInfo,
  FetchDocumentFn
} from '@types';

// Helper function to extract page number from highlightId
const extractPageNumberFromHighlightId = (highlightId: string): number => {
  const match = highlightId.match(/(\d{4})$/);
  if (match) {
    return parseInt(match[1], 10); // Returns 0 for first page, 1 for second, etc.
  }
  return 0; // Default to first page
};

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
    setState(prev => ({ ...prev, isOpen: false, document: null, highlightedElementId: null, citationSnippet: null }));
  }, []);

  const highlightElement = useCallback((elementId: string) => {
    setState(prev => ({ ...prev, highlightedElementId: elementId }));
  }, []);

  const loadDocument = useCallback(async (sourceLink: string, highlightId?: string, citationSnippet?: string) => {
    setState(prev => ({ ...prev, isLoading: true, document: null, isOpen: true }));
    const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
    if (!fetchFn) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('No fetchDocumentFn provided. Cannot load document.');
    }
    try {
      const response = await fetchFn(sourceLink);
      
      // Ensure the response has the sourceLink
      const documentWithSourceLink = { ...response, sourceLink };
      
      // Extract page number from highlightId if provided
      const pageNumber = highlightId ? extractPageNumberFromHighlightId(highlightId) : undefined;
      
      // Update or create tab for this document
      const currentTabs = [...state.tabs];
      const existingTabIndex = currentTabs.findIndex(tab => tab.sourceLink === sourceLink);
      
      if (existingTabIndex !== -1) {
        // Update existing tab
        currentTabs[existingTabIndex] = {
          ...documentWithSourceLink,
          isActive: true,
          pageNumber,
          citationSnippet: citationSnippet || null,
          isLoading: false
        };
        // Set other tabs as inactive
        currentTabs.forEach((tab, index) => {
          if (index !== existingTabIndex) {
            tab.isActive = false;
          }
        });
      } else {
        // Create new tab and set it as active
        const newTab: TabInfo = {
          ...documentWithSourceLink,
          isActive: true,
          pageNumber,
          citationSnippet: citationSnippet || null,
          isLoading: false
        };
        // Set other tabs as inactive
        currentTabs.forEach(tab => {
          tab.isActive = false;
        });
        currentTabs.unshift(newTab);
      }
      
      setState(prev => ({
        ...prev,
        document: documentWithSourceLink,
        isLoading: false,
        highlightedElementId: highlightId || null,
        citationSnippet: citationSnippet || null,
        tabs: currentTabs
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, document: null, highlightedElementId: null, citationSnippet: null }));
      throw error;
    }
  }, [providedFetchFn, state.tabs]);

  const selectTab = useCallback((sourceLink: string) => {
    if (!sourceLink || typeof sourceLink !== 'string' || sourceLink.trim() === '') {
      throw new Error('Cannot select tab: sourceLink must be a non-empty string');
    }
    
    const currentTabs = [...state.tabs];
    const existingTabIndex = currentTabs.findIndex(tab => tab.sourceLink === sourceLink);
    
    if (existingTabIndex !== -1) {
      const selectedTab = currentTabs[existingTabIndex];
      
      // If this tab is already active and showing the same document, just return
      if (selectedTab.isActive && state.document && 
          state.document.originalFileUrl === selectedTab.originalFileUrl) {
        return;
      }
      
      // Set the selected tab as active and others as inactive
      currentTabs.forEach((tab, index) => {
        tab.isActive = index === existingTabIndex;
      });
      
      // Load the document with the tab's saved state
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (!fetchFn) {
        updateDocumentViewer({ isLoading: false });
        throw new Error('No fetchDocumentFn provided. Cannot load document for the selected tab.');
      }
      
      updateDocumentViewer({ isLoading: true, tabs: currentTabs });
      
      fetchFn(sourceLink)
        .then(response => {
          // Ensure the response has the sourceLink
          const documentWithSourceLink = { ...response, sourceLink };
          
          setDocument(documentWithSourceLink);
          
          // Create highlightId from pageNumber if available
          let highlightId: string | null = null;
          if (selectedTab.pageNumber !== undefined) {
            // Convert pageNumber back to highlightId format (4-digit zero-padded)
            const pageId = selectedTab.pageNumber.toString().padStart(4, '0');
            highlightId = pageId;
          }
          
          setState(prev => ({
            ...prev,
            document: documentWithSourceLink,
            isLoading: false,
            highlightedElementId: highlightId,
            citationSnippet: selectedTab.citationSnippet || null,
            tabs: currentTabs
          }));
        })
        .catch(() => {
          updateDocumentViewer({ isLoading: false });
        });
    } else {
      // If the tab doesn't exist, create a new one
      try {
        const newTab: TabInfo = {
          sourceLink,
          documentCategory: '',
          formType: null,
          ticker: '',
          companyName: '',
          date: null,
          fiscalQuarter: null,
          fiscalYear: null,
          originalFileUrl: '',
          markdownFileUrl: '',
          metadata: {},
          fileType: 'pdf',
          isActive: true,
          isLoading: true
        };
        
        // Set other tabs as inactive
        currentTabs.forEach(tab => {
          tab.isActive = false;
        });
        currentTabs.unshift(newTab);
        
        updateDocumentViewer({ tabs: currentTabs, isLoading: true });
        
        const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
        if (!fetchFn) {
          updateDocumentViewer({ isLoading: false });
          throw new Error('No fetchDocumentFn provided. Cannot load document for the new tab.');
        }
        
        fetchFn(sourceLink)
          .then(response => {
            // Ensure the response has the sourceLink
            const documentWithSourceLink = { ...response, sourceLink };
            
            setDocument(documentWithSourceLink);
            const updatedTabs = currentTabs.map(tab =>
              tab.sourceLink === sourceLink ? { ...tab, ...documentWithSourceLink, isLoading: false } : tab
            );
            updateDocumentViewer({ tabs: updatedTabs, isLoading: false });
          })
          .catch(() => {
            const updatedTabs = currentTabs.map(tab =>
              tab.sourceLink === sourceLink ? { ...tab, isLoading: false } : tab
            );
            updateDocumentViewer({ isLoading: false, tabs: updatedTabs });
          });
      } catch (error) {
        const errorTab: TabInfo = {
          sourceLink,
          documentCategory: '',
          formType: null,
          ticker: '',
          companyName: '',
          date: null,
          fiscalQuarter: null,
          fiscalYear: null,
          originalFileUrl: '',
          markdownFileUrl: '',
          metadata: {},
          fileType: 'pdf',
          isActive: true,
          isLoading: false
        };
        currentTabs.unshift(errorTab);
        updateDocumentViewer({ tabs: currentTabs, isLoading: false });
      }
    }
  }, [state.tabs, state.document, updateDocumentViewer, providedFetchFn, setDocument]);

  const closeTab = useCallback((sourceLink: string) => {
    const updatedTabs = state.tabs.filter(tab => tab.sourceLink !== sourceLink);
    
    // If no tabs remain, close the viewer
    if (updatedTabs.length === 0) {
      setState(prev => ({
        ...prev,
        isOpen: false,
        document: null,
        highlightedElementId: null,
        citationSnippet: null,
        tabs: []
      }));
      return;
    }
    
    // If we're closing the currently active tab, activate the first remaining tab
    if (state.document && 
        state.document.originalFileUrl === state.tabs.find(tab => tab.sourceLink === sourceLink)?.originalFileUrl) {
      const firstTab = updatedTabs[0];
      firstTab.isActive = true;
      
      // Load the first tab's document
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (fetchFn) {
        fetchFn(firstTab.sourceLink)
          .then(response => {
            // Ensure the response has the sourceLink
            const documentWithSourceLink = { ...response, sourceLink: firstTab.sourceLink };
            
            let highlightId: string | null = null;
            if (firstTab.pageNumber !== undefined) {
              const pageId = firstTab.pageNumber.toString().padStart(4, '0');
              highlightId = pageId;
            }
            
            setState(prev => ({
              ...prev,
              document: documentWithSourceLink,
              highlightedElementId: highlightId,
              citationSnippet: firstTab.citationSnippet || null,
              tabs: updatedTabs
            }));
          })
          .catch(() => {
            setDocument(null);
            updateDocumentViewer({ tabs: updatedTabs });
          });
      } else {
        setDocument(null);
        updateDocumentViewer({ tabs: updatedTabs });
      }
    } else {
      updateDocumentViewer({ tabs: updatedTabs });
    }
  }, [state.tabs, state.document, updateDocumentViewer, providedFetchFn, setDocument]);

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

  const reorderTabs = useCallback((newTabsOrder: TabInfo[]) => {
    setState(prev => ({ ...prev, tabs: newTabsOrder }));
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
    reorderTabs,
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