import React, { useEffect, useRef, useState } from 'react';
import { useDocumentViewer } from '../../contexts/DocumentViewerContext';
import ShareableLinkTooltip from '../ShareableLinkTooltip';
import { DocumentViewerProps, TooltipPosition } from './types';
import { isInternationalFiling, isProxyStatement } from './utils/documentProcessing';
import dynamicImport from './dynamicImport';

// Import the HTML viewer normally - it can be SSR'd
import HTMLViewer from './HTMLViewer';

// Dynamically import browser-only components with no SSR
const PDFViewer = dynamicImport(() => import('./PDFViewer'), { ssr: false });
const SpreadsheetViewer = dynamicImport(() => import('./SpreadsheetViewer'), { ssr: false });

/**
 * DocumentViewer Component
 * 
 * This is the main entry point for the document viewer.
 * It handles loading the appropriate viewer based on the document type:
 * - HTML Viewer for HTML content (SEC filings, 10-K, 10-Q, 8-K, etc.)
 * - PDF Viewer for PDF documents
 * - Spreadsheet Viewer for Excel/CSV files
 * 
 * Features:
 * - Support for all document types (10-K/10-Q filings, 8-K documents, and earnings call transcripts)
 * - Support for international filings (20-F, 40-F, and 6-K documents) with comment-based highlighting
 * - Smart element highlighting with clustering
 * - Efficient document reloading on content change
 * - Zoom controls for adjusting document scale
 * - Hover-to-share functionality for highlighted elements
 * - Support for PDF and Excel documents from IR sites
 */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  className = 'w-full h-full',
  style,
  showZoomControls = true,
  enableShareableLinks = true,
  shareableLinkBaseUrl,
  shareableLinkButtonColor = '#2563eb',
  viewerRoutePath = 'document-viewer'
}) => {
  // Sharing is enabled if shareableLinkBaseUrl is provided AND enableShareableLinks is not explicitly false
  const areShareableLinksEnabled = !!shareableLinkBaseUrl && enableShareableLinks !== false;
  
  const { 
    document, 
    highlightedElementId, 
    isLoading, 
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom
  } = useDocumentViewer();
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle wheel events on the container to prevent page scrolling when zooming
  const handleContainerScroll = (event: React.WheelEvent) => {
    // Check if Ctrl key is pressed (zooming)
    if (event.ctrlKey) {
      event.preventDefault();
      // Implement smooth zooming
      if (event.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  };

  // Ensure scrolling works regardless of focus
  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;
    
    // Function to handle scroll events from the container
    const handleContainerScroll = (event: WheelEvent) => {
      // If ctrl is pressed, let the zoom handler take care of it
      if (event.ctrlKey) return;
      
      // Otherwise, allow normal scrolling behavior
      // No need to prevent default or handle custom scrolling
    };
    
    // Add scroll event listener to the container
    containerElement.addEventListener('wheel', handleContainerScroll, { passive: true });
    
    // Clean up event listener on unmount
    return () => {
      containerElement.removeEventListener('wheel', handleContainerScroll);
    };
  }, []);
  
  // Create a React.Suspense fallback for dynamic components
  const loadingFallback = (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-lg font-medium text-gray-500">
        Loading viewer component...
      </div>
    </div>
  );

  // Determine which viewer to render based on document type and file type
  const renderAppropriateViewer = () => {
    // If no document or loading, show loading state
    if (!document || isLoading) {
      console.log('[DocumentViewer] No document or still loading:', { 
        documentExists: !!document, 
        isLoading 
      });
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-lg font-medium text-gray-500">
            {isLoading ? 'Loading document...' : 'No document loaded'}
          </div>
        </div>
      );
    }

    // Debug document properties
    console.log('[DocumentViewer] Document properties:', {
      sourceType: document.sourceType,
      fileType: document.fileType,
      sasUrl: document.sasUrl,
      contentType: document.contentType,
      fileName: document.fileName
    });

    // CASE 1: PDF Documents
    // For documents with PDF file type or PDF content type
    const isPDF = document.fileType === 'pdf' || 
                  document.contentType === 'application/pdf' ||
                  (document.fileName && document.fileName.toLowerCase().endsWith('.pdf'));
      
    if (isPDF && document.sasUrl) {
      console.log('[DocumentViewer] ✅ Rendering PDF viewer');
      console.log(`[DocumentViewer] Using sasUrl: ${document.sasUrl.substring(0, 50)}...`);
      
      return (
        <React.Suspense 
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <div className="text-lg font-medium text-gray-500">Loading PDF viewer...</div>
              <div className="text-sm text-gray-400 mt-2">This may take a moment</div>
            </div>
          }
        >
          <PDFViewer
            sasUrl={document.sasUrl}
            className={className}
            style={style}
            zoomLevel={zoomLevel}
            highlightedElementId={highlightedElementId}
            key={`pdf-${document.sasUrl}`}
          />
        </React.Suspense>
      );
    }
      
    // CASE 2: Excel/Spreadsheet Documents
    const isSpreadsheet = document.fileType === 'xlsx' || 
          document.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         (document.fileName && 
                          (document.fileName.toLowerCase().endsWith('.xlsx') || 
                           document.fileName.toLowerCase().endsWith('.csv') || 
                           document.fileName.toLowerCase().endsWith('.xls')));
                           
    if (isSpreadsheet && document.sasUrl) {
      console.log('[DocumentViewer] ✅ Rendering Spreadsheet viewer');
      console.log(`[DocumentViewer] Using sasUrl: ${document.sasUrl.substring(0, 50)}...`);
      
      return (
        <React.Suspense fallback={loadingFallback}>
          <SpreadsheetViewer
            sasUrl={document.sasUrl}
            className={className}
            style={style}
            zoomLevel={zoomLevel}
            document={document}
          />
        </React.Suspense>
      );
    }

    // CASE 3: HTML Documents (the default case)
    console.log('[DocumentViewer] ✅ Rendering HTML viewer');
    return (
      <HTMLViewer
        document={document}
        highlightedElementId={highlightedElementId}
        zoomLevel={zoomLevel}
        className={className}
        style={style}
        enableShareableLinks={enableShareableLinks}
        shareableLinkBaseUrl={shareableLinkBaseUrl}
        shareableLinkButtonColor={shareableLinkButtonColor}
            viewerRoutePath={viewerRoutePath}
          />
    );
  };

  // Render the component
  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
      onWheel={handleContainerScroll}
    >
      {renderAppropriateViewer()}
      
      {/* Zoom controls UI */}
      {showZoomControls && (
        <div className="absolute bottom-4 right-4 bg-white flex items-center"
          style={{
            padding: '3px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            borderRadius: '6px'
          }}
        >
          <button
            onClick={zoomOut}
            className="p-2 hover:bg-gray-100 text-gray-600"
            aria-label="Zoom out"
            style={{
              fontSize: '13px',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              margin: '0 1px',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          
          <button
            onClick={zoomIn}
            className="p-2 hover:bg-gray-100 text-gray-600"
            aria-label="Zoom in"
            style={{
              fontSize: '13px',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              margin: '0 1px',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          
          <div style={{
            width: '64px', 
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '500',
            color: '#4b5563',
            padding: '0 4px'
          }}>
            {Math.round(zoomLevel * 100)}%
          </div>
          
          <button
            onClick={resetZoom}
            className="p-2 hover:bg-gray-100 text-gray-600"
            aria-label="Reset zoom"
            style={{
              fontSize: '13px',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              margin: '0 1px',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 16h5v5"></path>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer; 