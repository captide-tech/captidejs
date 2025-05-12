/**
 * TypeScript declarations for PDF viewer extensions
 */

interface PDFViewerApplication {
  page: number;
  pagesCount: number;
  initialBookmark: string | null;
  [key: string]: any;
}

// Extend the Window interface to include PDF.js properties
interface Window {
  PDFViewerApplication?: PDFViewerApplication;
} 