import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  DocumentViewerState, 
  DocumentViewerContextValue, 
  SourceDocument,
  HtmlSourceDocument,
  BinarySourceDocument,
  InternalDocument,
  FetchDocumentFn,
  SourceDocumentBase,
  TabInfo,
  SourceType,
  FileType
} from '../types';

// Define valid source types array based on the SourceType type
const VALID_SOURCE_TYPES: SourceType[] = [
  '10-k', '10-q', '8-k', 'transcript', 'def 14a', 'defm14a', 
  'def 14c', 'defm14c', '20-f', '40-f', '6-k', 's-1', 'ir'
];

// DIAGNOSTIC CODE: This will log as soon as this module is imported
console.log('[DIAGNOSTIC] DocumentViewerContext module loaded - version 0.1.20', {
  validSourceTypes: VALID_SOURCE_TYPES
});

// Initial state for the context
const initialState: DocumentViewerState = {
  document: null,
  highlightedElementId: null,
  isLoading: false,
  isOpen: false,
  tabs: [],
  zoomLevel: 0.8
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
 * @param sourceLink - The source link containing the sourceType parameter
 * @returns The source type value
 * @throws Error if the sourceLink cannot be parsed or lacks a valid sourceType
 */
function extractSourceTypeFromUrl(sourceLink: string): SourceType {
  try {
    const url = new URL(sourceLink);
    const sourceTypeParam = url.searchParams.get('sourceType');
    
    if (!sourceTypeParam) {
      console.warn(`Missing sourceType parameter in sourceLink: ${sourceLink}, defaulting to "ir"`);
      return 'ir'; // Default to ir if not specified
    }
    
    // Make comparison case-insensitive by converting to lowercase
    const normalizedSourceType = sourceTypeParam.toLowerCase();
    
    // Validate that sourceTypeParam is a valid SourceType
    if (VALID_SOURCE_TYPES.includes(normalizedSourceType as SourceType)) {
      return normalizedSourceType as SourceType;
    }
    
    // If not valid, log a warning and return a default type
    console.warn(`Invalid sourceType parameter in sourceLink: ${sourceTypeParam}, defaulting to "ir"`);
    return 'ir';
  } catch (e) {
    // Add more context to the error
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Failed to parse sourceLink URL: ${sourceLink}. ${error.message}`);
    return 'ir'; // Default to ir for error cases
  }
}

/**
 * Extract file type from a sourceLink URL
 * 
 * @param sourceLink - The source link containing the fileType parameter
 * @returns The file type value or null if not specified
 */
function extractFileTypeFromUrl(sourceLink: string): FileType {
  try {
    const url = new URL(sourceLink);
    const fileTypeParam = url.searchParams.get('fileType');
    
    // Check if fileType is a valid type
    if (fileTypeParam === 'pdf' || fileTypeParam === 'xlsx') {
      return fileTypeParam;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Convert a SourceDocument (either HTML or Binary) to an InternalDocument
 * This function handles documents with SAS URLs
 */
function convertToInternalDocument(document: SourceDocument, highlightedElementId: string | null = null): InternalDocument {
  console.log('[DocumentViewerContext] Converting document to internal format:', document);
  
  // Safety check for missing or malformed document
  if (!document || typeof document !== 'object') {
    console.error('[DocumentViewerContext] Invalid document provided:', document);
    throw new Error('Invalid document provided to convertToInternalDocument');
  }
  
  // Detect if this is an object with a sasUrl property but missing other required properties
  // Add safeguards for malformed document objects
  if (!document.sourceType) {
    console.warn('[DocumentViewerContext] Document missing sourceType - using default "ir"');
    (document as any).sourceType = 'ir';
  }
  
  if (!document.sourceLink) {
    console.warn('[DocumentViewerContext] Document missing sourceLink');
    (document as any).sourceLink = 'unknown';
  }
  
  // Normalize sourceType to lowercase to handle case-insensitive matching
  // This ensures values like "IR" will be converted to "ir" to match our type definition
  const normalizedSourceType = ((document.sourceType || '') + '').toLowerCase() as SourceType;
  
  console.log('[DocumentViewerContext] Normalized sourceType:', { 
    original: document.sourceType, 
    normalized: normalizedSourceType 
  });
  
  const normalizedDoc = {
    ...document,
    sourceType: normalizedSourceType
  };
  
  // Special case for documents with sasUrl (binary documents)
  if ((normalizedDoc as any).sasUrl) {
    console.log('[DocumentViewerContext] Processing document with SAS URL:', (normalizedDoc as any).sasUrl.substring(0, 50) + '...');
    
    // Ensure the SAS URL properly includes the signature and all parameters
    const sasUrl = (normalizedDoc as any).sasUrl;
    const hasValidSasParams = sasUrl && 
                             sasUrl.includes('sig=') && 
                             (sasUrl.includes('se=') || sasUrl.includes('sp='));
    
    if (!hasValidSasParams) {
      console.warn('[DocumentViewerContext] SAS URL appears to be missing required parameters');
    }
    
    const internalDoc = {
      sourceLink: normalizedDoc.sourceLink,
      sourceType: normalizedDoc.sourceType, 
      date: (normalizedDoc as any).date || '',
      htmlContent: '', // Empty for binary documents
      ticker: (normalizedDoc as any).ticker || '',
      fiscalPeriod: (normalizedDoc as any).fiscalPeriod || '',
      companyName: (normalizedDoc as any).companyName || '',
      highlightedElementId: highlightedElementId,
      fileType: (normalizedDoc as any).fileType as FileType || 
               (((normalizedDoc as any).fileName || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 
               (((normalizedDoc as any).fileName || '').toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'pdf')), 
      // Pass through additional properties
      contentType: (normalizedDoc as any).contentType || 
                  (((normalizedDoc as any).fileName || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 
                  (((normalizedDoc as any).fileName || '').toLowerCase().endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream')),
      fileName: (normalizedDoc as any).fileName,
      sasUrl: (normalizedDoc as any).sasUrl,
      // Include metadata from the original document
      metadata: (normalizedDoc as any).metadata
    };
    
    console.log('[DocumentViewerContext] Created internal document from SAS URL:', internalDoc);
    return internalDoc;
  }
  
  // For HTML documents, just add the highlightedElementId
  console.log('[DocumentViewerContext] Processing HTML document');
  return {
    ...normalizedDoc as HtmlSourceDocument,
    highlightedElementId: highlightedElementId
  };
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
  
  // Create a fetch function ref to avoid unnecessary re-renders
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
  const setDocument = useCallback((document: InternalDocument | null) => {
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
    updateDocumentViewer({ 
      isOpen: true,
      tabs: [] // Start with empty tabs when opening the viewer
    });
  }, [updateDocumentViewer]);

  /**
   * Close the document viewer
   */
  const closeViewer = useCallback(() => {
    updateDocumentViewer({ 
      isOpen: false,
      document: null,
      highlightedElementId: null,
      tabs: [] // Clear all tabs when closing the viewer
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

    console.log('[DocumentViewerContext] Loading document:', { sourceLink, elementId, version: '0.1.20' });

    // Ensure we have a fetch function
    const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
    if (!fetchFn) {
      throw new Error(
        'No fetchDocumentFn provided. Use setFetchDocumentFn to set a function for fetching documents or provide it to the DocumentViewerProvider.'
      );
    }

    // Open the viewer if it's not already open
    if (!state.isOpen) {
      openViewer();
    }

    // Check if we already have this document loaded and just need to update the highlight
    const isCurrentDocument = state.document && state.document.sourceLink === sourceLink;
    
    if (isCurrentDocument) {
      console.log('Document already loaded, just updating highlight:', sourceLink);
      // Just update the highlightedElementId without reloading the document
      updateDocumentViewer({ 
        highlightedElementId: elementId || null
      });
      
      // Also update the document with the highlightedElementId to keep state consistent
      if (state.document) {
        setDocument({
          ...state.document,
          highlightedElementId: elementId || null
        });
      }
      
      return;
    }

    // Check if a tab already exists for this document
    const existingTabIndex = state.tabs.findIndex(tab => tab.sourceLink === sourceLink);
    let updatedTabs = [...state.tabs];
    
    // Extract source type from URL for creating new tabs
    let sourceType: SourceType;
    try {
      sourceType = extractSourceTypeFromUrl(sourceLink);
    } catch (error) {
      console.error('Failed to extract source type:', error);
      sourceType = sourceLink.includes('transcript') ? 'transcript' : '10-k';
    }
    
    // Extract file type for 'ir' documents
    let fileType: FileType = null;
    if (sourceType === 'ir') {
      fileType = extractFileTypeFromUrl(sourceLink);
    }
    
    if (existingTabIndex === -1) {
      // If no tab exists, create a new one
      try {
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
        const sourceTypeGuess: SourceType = sourceLink.includes('transcript') ? 'transcript' : '10-k';
        
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
      const response = await fetchFn(sourceLink);
      console.log('[DocumentViewerContext] Received API response:', response);
      
      // Convert the source document to an internal document
      const internalDocument = convertToInternalDocument(response, elementId || null);
      console.log('[DocumentViewerContext] Converted to internal document:', internalDocument);
      
      // Update the tab info with the loaded document data
      const updatedTabsAfterLoad = updatedTabs.map(tab => {
        if (tab.sourceLink === sourceLink) {
          return {
            ...tab,
            sourceType: internalDocument.sourceType,
            ticker: internalDocument.ticker,
            fiscalPeriod: internalDocument.fiscalPeriod,
            isLoading: false
          };
        }
        return tab;
      });
      
      // CRITICAL: Update everything in a single state update to avoid race conditions
      // This ensures the document and tabs are updated atomically
      console.log('[DocumentViewerContext] Updating document viewer state with new document');
      updateDocumentViewer({ 
        document: internalDocument,
        tabs: updatedTabsAfterLoad, 
        isLoading: false,
        highlightedElementId: elementId || null 
      });

      // No need to call highlightElement separately, as we've already set the highlightedElementId
    } catch (error) {
      console.error('[DocumentViewerContext] Failed to load document:', error);
      
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
  }, [state.tabs, state.isOpen, state.document, updateDocumentViewer, openViewer, setDocument]);

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
    
    // Extract source type from URL for new tabs
    let sourceType: SourceType;
    try {
      sourceType = extractSourceTypeFromUrl(sourceLink);
    } catch (error) {
      console.error('Failed to extract source type:', error);
      sourceType = sourceLink.includes('transcript') ? 'transcript' : '10-k';
    }
    
    // Extract file type for 'ir' documents
    let fileType: FileType = null;
    if (sourceType === 'ir') {
      fileType = extractFileTypeFromUrl(sourceLink);
    }
    
    if (existingTabIndex !== -1) {
      // If there's a document associated with this tab, load it
      if (state.document && state.document.sourceLink === sourceLink) {
        return; // Already showing this document
      }
      
      // Otherwise, load the document
      updateDocumentViewer({ isLoading: true });
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (!fetchFn) {
        updateDocumentViewer({ isLoading: false });
        throw new Error('No fetchDocumentFn provided. Cannot load document for the selected tab.');
      }
      
      fetchFn(sourceLink)
        .then(response => {
          // Convert the source document to an internal document
          const internalDocument = convertToInternalDocument(response);
          
          // IMPORTANT: Set document first, then update tabs to ensure correct tab selection
          setDocument(internalDocument);
          
          // Update the tab info with the loaded document data
          const updatedTabs = currentTabs.map(tab => {
            if (tab.sourceLink === sourceLink) {
              return {
                ...tab,
                sourceType: internalDocument.sourceType,
                ticker: internalDocument.ticker,
                fiscalPeriod: internalDocument.fiscalPeriod,
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
    
    // If the tab doesn't exist, create a new one AND place it at the front
    try {
      // Create a new tab with the extracted source type
      const newTab: TabInfo = {
        sourceLink,
        sourceType,
        ticker: null,
        fiscalPeriod: null,
        isLoading: true
      };
      
      // Add the new tab to the front - we still want this behavior for new tabs
      currentTabs.unshift(newTab);
      
      // Update the state
      updateDocumentViewer({ tabs: currentTabs, isLoading: true });
      
      // Load the document
      const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
      if (!fetchFn) {
        updateDocumentViewer({ isLoading: false });
        throw new Error('No fetchDocumentFn provided. Cannot load document for the new tab.');
      }
      
      fetchFn(sourceLink)
        .then(response => {
          // Convert the source document to an internal document
          const internalDocument = convertToInternalDocument(response);
          
          // IMPORTANT: Set document first to ensure correct tab selection
          setDocument(internalDocument);
          
          // Update the tab info with the loaded document data
          const updatedTabs = currentTabs.map(tab => {
            if (tab.sourceLink === sourceLink) {
              return {
                ...tab,
                sourceType: internalDocument.sourceType,
                ticker: internalDocument.ticker,
                fiscalPeriod: internalDocument.fiscalPeriod,
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
      
      // Show error to the user
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Even with an error, we should add the tab but mark it as having an error
      // This provides better UX by showing the user there was a problem with this tab
      const sourceTypeGuess: SourceType = sourceLink.includes('transcript') ? 'transcript' : '10-k';
      
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
        // If there are no tabs left, close the viewer entirely
        closeViewer();
      } else {
        // Otherwise, load the first tab without making a separate loadDocument call
        // which would potentially re-add the tab we just removed
        const nextTab = newTabs[0];
        
        updateDocumentViewer({
          tabs: newTabs,
          isLoading: true
        });
        
        // Fetch the document directly within this callback
        const fetchFn = fetchDocumentFnRef.current || providedFetchFn;
        if (!fetchFn) {
          updateDocumentViewer({ isLoading: false });
          throw new Error('No fetchDocumentFn provided. Cannot load document for the next tab.');
        }
        
        fetchFn(nextTab.sourceLink)
          .then(response => {
            // Convert the source document to an internal document
            const internalDocument = convertToInternalDocument(response);
            
            // Update everything in a single state update
            updateDocumentViewer({
              document: internalDocument,
              tabs: newTabs,
              isLoading: false,
              highlightedElementId: null
            });
          })
          .catch(error => {
            console.error('Failed to load next document after tab close:', error);
            updateDocumentViewer({ 
              isLoading: false,
              tabs: newTabs
            });
          });
      }
    } else {
      // Just update the tabs
      updateDocumentViewer({ tabs: newTabs });
    }
  }, [state.tabs, state.document, updateDocumentViewer, closeViewer, providedFetchFn]);

  /**
   * Sets the zoom level
   */
  const setZoomLevel = useCallback((level: number) => {
    // Constrain zoom level between reasonable bounds (25% to 200%)
    const constrainedLevel = Math.max(0.25, Math.min(2.0, level));
    updateDocumentViewer({ zoomLevel: constrainedLevel });
  }, [updateDocumentViewer]);

  /**
   * Increases the zoom level by a fixed increment
   */
  const zoomIn = useCallback(() => {
    // Calculate the new zoom level based on current state
    const newZoom = Math.min(2.0, state.zoomLevel + 0.1);
    // Update with an object, not a function
    updateDocumentViewer({ zoomLevel: newZoom });
  }, [updateDocumentViewer, state.zoomLevel]);

  /**
   * Decreases the zoom level by a fixed increment
   */
  const zoomOut = useCallback(() => {
    // Calculate the new zoom level based on current state
    const newZoom = Math.max(0.25, state.zoomLevel - 0.1);
    // Update with an object, not a function
    updateDocumentViewer({ zoomLevel: newZoom });
  }, [updateDocumentViewer, state.zoomLevel]);

  /**
   * Resets zoom to the default level (80%)
   */
  const resetZoom = useCallback(() => {
    updateDocumentViewer({ zoomLevel: 0.8 });
  }, [updateDocumentViewer]);

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