/**
 * Source document information
 */

/**
 * Document file types for binary documents
 * Only PDF is supported
 */
export type FileType = 'pdf';

// Extend the Window interface to include the highlightCaptidePage function
declare global {
  interface Window {
    highlightCaptidePage?: (pageNumber: number) => boolean;
  }
}

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
}

// FetchDocumentFn for the new model
export type FetchDocumentFn = (documentId: string) => Promise<Document>;

// DocumentViewerContextValue for the new model
export interface DocumentViewerContextValue extends DocumentViewerState {
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  setDocument: (document: Document | null) => void;
  loadDocument: (documentId: string, pageNumber?: number, citationSnippet?: string) => Promise<void>;
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  openViewer: () => void;
  closeViewer: () => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
} 