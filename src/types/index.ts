/**
 * Source document information
 */

/**
 * Defines the possible types of source documents
 */
export type SourceType = 
  | '10-k' | '10-K' 
  | '10-q' | '10-Q' 
  | '8-k' | '8-K' 
  | 'transcript' | 'TRANSCRIPT'
  | 'def 14a' | 'DEF 14A'
  | 'defm14a' | 'DEFM14A'
  | 'def 14c' | 'DEF 14C'
  | 'defm14c' | 'DEFM14C'
  | '20-f' | '20-F'
  | '40-f' | '40-F'
  | '6-k' | '6-K'
  | 's-1' | 'S-1'
  | 'ir' | 'IR';

/**
 * Document file types for binary documents
 */
export type FileType = 'pdf' | 'xlsx' | null;

// Extend the Window interface to include the highlightCaptidePage function
declare global {
  interface Window {
    highlightCaptidePage?: (pageNumber: number) => boolean;
  }
}

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
 * Used for standard HTML-based documents
 */
export interface HtmlSourceDocument extends SourceDocumentBase {
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
 * Binary document response for PDF or XLSX files
 * Used for non-HTML documents like PDF or Excel files
 */
export interface BinarySourceDocument extends SourceDocumentBase {
  /** Document date */
  date: string;
  
  /** Company name */
  companyName: string;
  
  /** Override ticker to make it required and non-null */
  ticker: string;
  
  /** Override fiscalPeriod to make it required and non-null */
  fiscalPeriod: string;
  
  /** Type of binary file */
  fileType: 'pdf' | 'xlsx';
  
  /** SAS URL for the document (Azure storage shared access signature) */
  sasUrl: string;
  
  /** Content type of the document */
  contentType?: string;
  
  /** File name of the document */
  fileName?: string;
  
  /** Additional metadata containing source information */
  metadata?: {
    /** URL to the original source webpage where the document was obtained */
    webpageUrl?: string;
    /** Any other metadata properties */
    [key: string]: any;
  };
}

/**
 * Union type for all source document types
 */
export type SourceDocument = HtmlSourceDocument | BinarySourceDocument;

/**
 * Internal document type used by the viewer
 * This shouldn't be directly exposed to users
 */
export interface InternalDocument extends HtmlSourceDocument {
  /** File type for binary documents */
  fileType?: FileType;
  
  /** Original SAS URL if provided */
  sasUrl?: string;
  
  /** Content type of the document */
  contentType?: string;
  
  /** File name of the document */
  fileName?: string;
  
  /** Additional metadata for the document */
  metadata?: {
    /** URL to the original source webpage where the document was obtained */
    webpageUrl?: string;
    /** Any other metadata properties */
    [key: string]: any;
  };
}

/**
 * Context state for the DocumentViewer
 */
export interface DocumentViewerState {
  /** The document being displayed */
  document: InternalDocument | null;
  
  /** Whether document is currently loading */
  isLoading: boolean;
  
  /** Whether the document viewer is open */
  isOpen: boolean;
  
  /** ID of element to highlight (should start with # and then an UUID of length 8) */
  highlightedElementId: string | null;
  
  /** Array of tabs in the document viewer */
  tabs: TabInfo[];

  /** Current zoom level (1.0 = 100%) */
  zoomLevel: number;
}

/**
 * Function to fetch document content from the API
 * Can return either an HTML document or a binary document
 */
export type FetchDocumentFn = (sourceLink: string) => Promise<SourceDocument>;

/**
 * DocumentViewer context value
 */
export interface DocumentViewerContextValue extends DocumentViewerState {
  /** Updates the DocumentViewer state */
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  
  /** Sets document, source type, and handles loading state */
  setDocument: (document: InternalDocument | null) => void;
  
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
  
  /** Set zoom level to a specific value (1.0 = 100%) */
  setZoomLevel: (level: number) => void;
  
  /** Increase zoom level */
  zoomIn: () => void;
  
  /** Decrease zoom level */
  zoomOut: () => void;
  
  /** Reset zoom to default (100%) */
  resetZoom: () => void;
} 