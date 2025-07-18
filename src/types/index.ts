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

export interface Document {
  sourceLink: string; // Unique identifier for the document, e.g. used for tabs
  documentCategory: string;
  formType: string | null;
  ticker: string;
  companyName: string;
  date: string | null;
  fiscalQuarter: number | null;
  fiscalYear: number | null;
  originalFileUrl: string;
  markdownFileUrl: string;
  metadata: Record<string, any>;
  fileType: FileType;
}

// TabInfo extends Document with tab-specific fields
export interface TabInfo extends Document {
  isActive: boolean;
  pageNumber?: number; // Optional page number when tab was last viewed
  citationSnippet?: string | null; // Optional citation snippet when tab was last viewed
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
export type FetchDocumentFn = (sourceLink: string) => Promise<Document>;

// DocumentViewerContextValue for the new model
export interface DocumentViewerContextValue extends DocumentViewerState {
  updateDocumentViewer: (updates: Partial<DocumentViewerState>) => void;
  setDocument: (document: Document | null) => void;
  highlightElement: (elementId: string) => void;
  loadDocument: (sourceLink: string, highlightId?: string, citationSnippet?: string) => Promise<void>;
  setFetchDocumentFn: (fn: FetchDocumentFn) => void;
  openViewer: () => void;
  closeViewer: () => void;
  selectTab: (sourceLink: string) => void;
  closeTab: (sourceLink: string) => void;
  reorderTabs: (newTabsOrder: TabInfo[]) => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
} 