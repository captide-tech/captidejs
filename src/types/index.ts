/**
 * Source document information
 */
export interface SourceDocument {
  /** HTML content of the document */
  htmlContent: string;
  
  /** Type of document */
  sourceType: '10-K' | '10-Q' | '8-K' | 'transcript';
  
  /** Document date */
  date: string;
  
  /** Fiscal period (e.g., 'Q1 2023') */
  fiscalPeriod: string;
  
  /** Stock ticker symbol */
  ticker: string;
  
  /** Company name */
  companyName: string;
  
  /** Source link (URL identifying this document) */
  sourceLink: string;
  
  /** Optional page number for 8-K documents */
  pageNumber?: number;
}

/**
 * Context state for the DocumentViewer
 */
export interface DocumentViewerState {
  /** The document being displayed */
  document: SourceDocument | null;
  
  /** Type of source document */
  sourceType: string | null;
  
  /** ID of element to highlight (should start with #) */
  highlightedElementId: string | null;
  
  /** Whether document is currently loading */
  isLoading: boolean;
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
} 