import DocumentViewer from './components/document-viewer';
export { DocumentViewer };

// Export context and hook
export { 
  DocumentViewerProvider,
  useDocumentViewer
} from './contexts/document-viewer-context'; 

export type { 
  Document, 
  TabInfo,
  DocumentViewerState,
  DocumentViewerContextValue,
  FetchDocumentFn,
  FileType
} from './types'; 