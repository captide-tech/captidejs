/**
 * Source document information
 */

/**
 * Document file types
 */
export type FileType = 'pdf' | 'html';

export interface Document {
  documentId: string; // Unique identifier for the document, e.g. used for tabs
  documentCategory: string;
  formType: string | null;
  tickers: string[];
  companyName: string;
  date: string | null;
  fiscalQuarter: number | null;
  fiscalYear: number | null;
  originalFileUrl: string;
  markdownFileUrl: string;
  metadata: Record<string, any>;
  fileType: FileType;
}

// DocumentViewerState for the new model
export interface DocumentViewerState {
  document: Document | null;
  isLoading: boolean;
  isOpen: boolean;
  zoomLevel: number;
  pageNumber?: number;
  citationSnippet?: string;
  citationMatchIndex?: number;
  // legacyElementId removed - backwards compatibility handled in loadDocument
}

/**
 * A location in a document, durable enough to put in a link. `matchIndex` is
 * 1-based and disambiguates text that repeats on the page; without it the first
 * match wins.
 */
export interface HighlightAnchor {
  text: string;
  page?: number;
  matchIndex?: number;
}

export interface LoadDocumentOptions {
  page?: number;
  snippet?: string;
  matchIndex?: number;
  legacyElementId?: string;
}

// FetchDocumentFn for the new model
export type FetchDocumentFn = (documentId: string) => Promise<Document>;

export interface DocumentSearchMatchesCount {
  current: number;
  total: number;
}

export interface DocumentSearchController {
  isOpen: boolean;
  query: string;
  matchesCount: DocumentSearchMatchesCount;
  isPending: boolean;
  isNotFound: boolean;
  /** Increments whenever the search input should take focus. */
  focusToken: number;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  findNext: () => void;
  findPrevious: () => void;
}

// DocumentViewerContextValue for the new model
/**
 * Imperative handle on DocumentViewer, for hosts that want to drive the find
 * bar from their own shortcut. The viewer's own Ctrl/Cmd+F only fires while
 * focus sits inside it, which is too narrow when the viewer owns the screen.
 */
export interface DocumentViewerHandle {
  openSearch: () => void;
  closeSearch: () => void;
  isSearchOpen: () => boolean;
  /** The current text selection as a linkable anchor, or null if there is none inside the viewer. */
  getSelectionAnchor: () => HighlightAnchor | null;
}

export interface DocumentViewerContextValue extends DocumentViewerState {
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  setDocument: (document: Document | null) => void;
  loadDocument: {
    (documentId: string, options?: LoadDocumentOptions): Promise<void>;
    (documentId: string, pageNumber?: number, citationSnippet?: string, legacyElementId?: string): Promise<void>;
  };
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  openViewer: () => void;
  closeViewer: () => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}
