/**
 * Captide Document Viewer
 * 
 * Version 2.0.0: Added support for binary documents (PDF and XLSX)
 * See docs/BINARY_DOCUMENTS.md for implementation details
 * 
 * IMPORTANT USAGE NOTE FOR NEXT.JS APPLICATIONS:
 * When using this component in Next.js applications, it should be imported
 * with the "use client" directive to ensure proper client-side rendering:
 * 
 * ```tsx
 * 'use client'
 * import { DocumentViewer } from 'captide'
 * ```
 * 
 * This is required because the DocumentViewer uses browser-specific APIs
 * for rendering PDF and spreadsheet documents.
 */

// Adding a console log for testing if local package is in use
console.log('LOCAL CAPTIDE PACKAGE LOADED - VERIFICATION');

// Import and export the main component
import DocumentViewer from './components/DocumentViewer/DocumentViewer';
export { DocumentViewer };

// Export context and hook
export { 
  DocumentViewerProvider,
  useDocumentViewer
} from './contexts/DocumentViewerContext';

// Export utils
export { parseDocumentViewerParams } from './utils/shareableLinks';

// Export types
export type {
  SourceDocument,
  SourceDocumentBase,
  TabInfo,
  SourceType,
  DocumentViewerState,
  DocumentViewerContextValue,
  FetchDocumentFn
} from './types';

// Export component prop types
export type { DocumentViewerProps } from './components/DocumentViewer/types'; 