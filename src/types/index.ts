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
  // legacyElementId removed - backwards compatibility handled in loadDocument
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
  caseSensitive: boolean;
  matchesCount: DocumentSearchMatchesCount;
  isPending: boolean;
  isNotFound: boolean;
  /** Increments whenever the search input should take focus. */
  focusToken: number;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  toggleCaseSensitive: () => void;
  findNext: () => void;
  findPrevious: () => void;
}

// DocumentViewerContextValue for the new model
export interface DocumentViewerContextValue extends DocumentViewerState {
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  setDocument: (document: Document | null) => void;
  loadDocument: (documentId: string, pageNumber?: number, citationSnippet?: string, legacyElementId?: string) => Promise<void>;
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  openViewer: () => void;
  closeViewer: () => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}
