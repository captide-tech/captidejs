// Direct exports from component files for clean imports

// Main DocumentViewer component
export { default } from './DocumentViewer';

// Individual specialized viewers
export { default as HTMLViewer } from './HTMLViewer';
export { default as PDFViewer } from './PDFViewer';
export { default as SpreadsheetViewer } from './SpreadsheetViewer';

// Types
export * from './types'; 