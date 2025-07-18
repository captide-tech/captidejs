/**
 * Source document information
 */

/**
 * Document file types for binary documents
 * Updated to remove null since the API always provides this for blob documents
 */
export type FileType = 'pdf' | 'xlsx';

// Extend the Window interface to include the highlightCaptidePage function
declare global {
  interface Window {
    highlightCaptidePage?: (pageNumber: number) => boolean;
  }
}

// DocumentV2Response model (frontend TypeScript version)
export interface Document {
  id: string;
  documentCategory: string;
  formType: string;
  ticker: string;
  companyName: string;
  date?: string | null;
  fiscalQuarter: number | null;
  fiscalYear: number | null;
  originalFileUrl: string;
  markdownFileUrl: string;
  metadata: Record<string, any>;
  fileType: FileType;
}

// TabInfo for the new model
export interface TabInfo {
  id: string;
  documentCategory: string;
  formType?: string | null;
  ticker?: string | null;
  companyName?: string | null;
  date?: string | null;
  fiscalQuarter?: number | null;
  fiscalYear?: number | null;
  originalFileUrl: string;
  markdownFileUrl: string;
  metadata: Record<string, any>;
  isLoading: boolean;
}

// DocumentViewerState for the new model
export interface DocumentViewerState {
  document: Document | null;
  isLoading: boolean;
  isOpen: boolean;
  highlightedElementId: string | null;
  citationSnippet: string | null;
  tabs: TabInfo[];
  zoomLevel: number;
}

// FetchDocumentFn for the new model
export type FetchDocumentFn = (id: string) => Promise<Document>;

// DocumentViewerContextValue for the new model
export interface DocumentViewerContextValue extends DocumentViewerState {
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  setDocument: (document: Document | null) => void;
  highlightElement: (elementId: string) => void;
  loadDocument: (sourceLink: string, id?: string, citationSnippet?: string) => Promise<void>;
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  openViewer: () => void;
  closeViewer: () => void;
  selectTab: (id: string) => void;
  closeTab: (id: string) => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
} 