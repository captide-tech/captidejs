/**
 * Source document information
 */

/**
 * Defines the possible types of source documents
 */
export type SourceType = '10-K' | '10-Q' | '8-K' | 'transcript';

/**
 * Base source document information
 * Contains the minimal information needed for tab management
 */
export interface SourceDocumentBase {
  /** Source link (URL identifying this document) */
  sourceLink: string;
  
  /** Type of document */
  sourceType: SourceType;
  
  /** Stock ticker symbol */
  ticker: string | null;
  
  /** Fiscal period (e.g., 'Q1 2023') */
  fiscalPeriod: string | null;
}

export interface TabInfo extends SourceDocumentBase {
  /** Whether the tab is currently loading */
  isLoading: boolean;
}

/**
 * Complete source document with HTML content and additional metadata
 */
export interface SourceDocument extends SourceDocumentBase {
  /** HTML content of the document */
  htmlContent: string;
  
  /** Document date */
  date: string;
  
  /** Company name */
  companyName: string;
  
  /** ID of element to highlight, for 8-K documents, the last 4 digits indicate page number */
  highlightedElementId?: string | null;
  
  /** Override ticker to make it required and non-null */
  ticker: string;
  
  /** Override fiscalPeriod to make it required and non-null */
  fiscalPeriod: string;
}

/**
 * Context state for the DocumentViewer
 */
export interface DocumentViewerState {
  /** The document being displayed */
  document: SourceDocument | null;
  
  /** Whether document is currently loading */
  isLoading: boolean;
  
  /** Whether the document viewer is open */
  isOpen: boolean;
  
  /** ID of element to highlight (should start with # and then an UUID of length 8) */
  highlightedElementId: string | null;
  
  /** Array of tabs in the document viewer */
  tabs: TabInfo[];
}

/**
 * Function to fetch document content from the API
 */
export type FetchDocumentFn = (sourceLink: string) => Promise<SourceDocument>;

/**
 * DocumentViewer context value
 */
export interface DocumentViewerContextValue extends DocumentViewerState {
  /** Updates the DocumentViewer state */
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  
  /** Sets document, source type, and handles loading state */
  setDocument: (document: SourceDocument | null) => void;
  
  /** Highlights an element in the current document */
  highlightElement: (elementId: string) => void;
  
  /** Fetches and displays a document with optional element highlighting */
  loadDocument: (sourceLink: string, elementId?: string) => Promise<void>;
  
  /** Sets the fetch document function to be used */
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  
  /** Open the document viewer */
  openViewer: () => void;
  
  /** Close the document viewer */
  closeViewer: () => void;
  
  /** Add a new tab or switch to existing tab */
  selectTab: (sourceLink: string) => void;
  
  /** Close a tab */
  closeTab: (sourceLink: string) => void;
} 