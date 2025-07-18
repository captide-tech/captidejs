import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import DownloadButton from '@components/document-viewer/shared/download-button';
import PageIndicator from '@components/document-viewer/pdf-viewer/page-indicator';
import { createRectangleHighlight, removeHighlight, type CurrentHighlight } from '@utils/pdf-highlighting';

interface PDFViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
  zoomLevel?: number | string;
  highlightedElementId?: string | null;
  citationSnippet?: string | null;
}

// Simple placeholder for SSR
const PDFPlaceholder: React.FC<{className?: string; style?: React.CSSProperties}> = ({
  className = 'w-full h-full', 
  style
}) => (
  <div className={className} style={{
    ...style,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f5f5f5',
    color: '#666'
  }}>
    PDF viewer loading...
  </div>
);

/**
 * PDF Viewer Component using PDF.js
 * 
 * Renders PDFs from SAS URLs with robust error handling and high-quality rendering.
 * Leverages PDF.js's built-in lazy loading capabilities.
 */
const PDFViewer: React.FC<PDFViewerProps> = ({
  sasUrl,
  className = 'w-full h-full',
  style,
  zoomLevel,
  highlightedElementId = null,
  citationSnippet = null
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [viewer, setViewer] = useState<any>(null);
  const [currentHighlight, setCurrentHighlight] = useState<CurrentHighlight | null>(null);
  
  // Only run in browser
  const isBrowser = typeof window !== 'undefined';

  // Add highlighting styles
  if (typeof window !== 'undefined' && !document.getElementById('pdf-rectangle-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'pdf-rectangle-highlight-style';
    style.textContent = `
      .pdf-rectangle-highlight {
        position: absolute !important;
        background: rgba(255, 235, 59, 0.3) !important;
        border: 2px solid #fdcb6e !important;
        border-radius: 3px !important;
        pointer-events: none !important;
        z-index: 1000 !important;
        box-shadow: 0 2px 8px rgba(253, 203, 110, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Remove current highlight
  const removeCurrentHighlight = useCallback(() => {
    if (currentHighlight) {
      removeHighlight(currentHighlight);
      setCurrentHighlight(null);
    }
  }, [currentHighlight]);

  // Handle download functionality
  const handleDownload = () => {
    if (!sasUrl) return;
    
    fetch(sasUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        
        let filename = 'document.pdf';
        try {
          const urlObj = new URL(sasUrl);
          const pathParts = urlObj.pathname.split('/');
          const potentialFilename = pathParts[pathParts.length - 1];
          
          if (potentialFilename && potentialFilename.includes('.pdf')) {
            filename = decodeURIComponent(potentialFilename.split('?')[0]);
          }
        } catch (e) {
          // Fall back to default name
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      })
      .catch(error => {
        window.open(sasUrl, '_blank');
      });
  };
  
  // Initialize PDF.js in browser
  useEffect(() => {
    if (!isBrowser) return;
    let mounted = true;

    const loadPdfJs = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const { GlobalWorkerOptions } = await import('pdfjs-dist');
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        GlobalWorkerOptions.workerSrc = workerUrl;
        
        // Pre-fetch the worker
        try {
          const preloadWorker = document.createElement('link');
          preloadWorker.rel = 'preload';
          preloadWorker.as = 'script';
          preloadWorker.href = workerUrl;
          document.head.appendChild(preloadWorker);
        } catch (e) {
          // Ignore preload errors
        }
        
        // Load viewer CSS if not already loaded
        if (!document.getElementById('pdfjs-viewer-styles')) {
          const link = document.createElement('link');
          link.id = 'pdfjs-viewer-styles';
          link.rel = 'stylesheet';
          link.href = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/web/pdf_viewer.css`;
          document.head.appendChild(link);
          
          // Add custom styles
          const customStyles = document.createElement('style');
          customStyles.id = 'pdf-custom-styles';
          customStyles.textContent = `
            .pdf-container {
              position: absolute;
              width: 100%;
              height: 100%;
              overflow: auto;
              background-color: #f8f9fa;
            }
            .pdfViewer .page {
              margin: 15px auto;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }
            .pdfViewer .page.highlighted {
              box-shadow: 0 0 15px 5px rgba(255, 235, 59, 0.5);
            }
          `;
          document.head.appendChild(customStyles);
        }
        
        if (mounted) {
          setPdfJsLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to load PDF.js: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      }
    };

    loadPdfJs();
    
    return () => {
      mounted = false;
    };
  }, [isBrowser]);

  // Load and render PDF when URL changes and PDF.js is loaded
  useEffect(() => {
    if (!isBrowser || !sasUrl || !pdfJsLoaded || !viewerContainerRef.current) return;
    
    let mounted = true;
    let pdfViewerInstance: any = null;
    let pdfDocumentInstance: PDFDocumentProxy | null = null;
    let eventBusInstance: any = null;
    
    const loadAndRenderPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const pdfjsLib = await import('pdfjs-dist');
        const viewerModule = await import('pdfjs-dist/web/pdf_viewer.mjs');
        
        if (!mounted || !viewerContainerRef.current) return;
        
        // Clear previous viewer
        viewerContainerRef.current.innerHTML = '';
        
        // Create viewer elements
        const viewerContainer = document.createElement('div');
        viewerContainer.className = 'pdf-container';
        
        const viewerElement = document.createElement('div');
        viewerElement.className = 'pdfViewer';
        viewerContainer.appendChild(viewerElement);
        
        viewerContainerRef.current.appendChild(viewerContainer);
        
        // Create event bus
        eventBusInstance = new viewerModule.EventBus();
        
        // Create link service
        const pdfLinkService = new viewerModule.PDFLinkService({
          eventBus: eventBusInstance,
        });
        
        // Create viewer
        // @ts-ignore
        pdfViewerInstance = new viewerModule.PDFViewer({
          container: viewerContainer,
          viewer: viewerElement,
          eventBus: eventBusInstance,
          linkService: pdfLinkService,
          textLayerMode: 2, // Enable text layer
          removePageBorders: false,
        });
        
        pdfLinkService.setViewer(pdfViewerInstance);
        
        // Set up event listeners
        eventBusInstance.on('pagesinit', () => {
          // Set initial zoom level
          if (pdfViewerInstance && zoomLevel !== undefined) {
            if (typeof zoomLevel === 'string') {
              pdfViewerInstance.currentScaleValue = zoomLevel;
            } else {
              pdfViewerInstance.currentScale = zoomLevel;
            }
          }
          
          // Navigate to specific page if highlightedElementId is provided
          if (highlightedElementId && pdfViewerInstance && mounted) {
            const match = highlightedElementId.match(/(\d{4})$/);
            let pageNum = 1;
            if (match) {
              pageNum = parseInt(match[1], 10) + 1; // PDF.js is 1-based
            }
            
            // Validate page number is within bounds
            if (pageNum >= 1 && pageNum <= pdfViewerInstance.pagesCount) {
              pdfViewerInstance.currentPageNumber = Number(pageNum);
              
              // Highlight the page after a short delay
              setTimeout(() => {
                if (mounted && pdfViewerInstance) {
                  const pageDiv = pdfViewerInstance.getPageView(pageNum - 1)?.div;
                  if (pageDiv) {
                    pageDiv.classList.add('highlighted');
                    pageDiv.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'center' 
                    });
                  }
                }
              }, 200);
            }
          }
        });
        
        eventBusInstance.on('pagechanging', (evt: any) => {
          if (mounted) {
            const pageNumber = parseInt(evt.pageNumber, 10) || 1;
            setCurrentPage(pageNumber);
          }
        });
        
        // Load the document
        const loadingTask = pdfjsLib.getDocument({
          url: sasUrl,
          withCredentials: false,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });
        
        pdfDocumentInstance = await loadingTask.promise;
        
        if (!mounted || !pdfViewerInstance) return;
        
        // Set the document in the viewer
        pdfViewerInstance.setDocument(pdfDocumentInstance);
        pdfLinkService.setDocument(pdfDocumentInstance);

        setNumPages(pdfDocumentInstance.numPages);
        setViewer(pdfViewerInstance);

        // Set zoom after document is loaded
        if (pdfViewerInstance && zoomLevel !== undefined) {
          if (typeof zoomLevel === 'string') {
            pdfViewerInstance.currentScaleValue = zoomLevel;
          } else {
            pdfViewerInstance.currentScale = zoomLevel;
          }
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to load or render PDF: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      }
    };
    
    loadAndRenderPdf();
    
    return () => {
      mounted = false;
      
      // Clean up
      if (eventBusInstance) {
        eventBusInstance.off('pagesinit');
        eventBusInstance.off('pagechanging');
      }
      
      if (pdfDocumentInstance) {
        pdfDocumentInstance.destroy();
      }
    };
  }, [sasUrl, pdfJsLoaded, zoomLevel, highlightedElementId, isBrowser]);

  // Handle text highlighting when citationSnippet changes
  useEffect(() => {
    if (citationSnippet && viewer && !isLoading) {
      // Check if we already have a highlight for this exact text
      if (currentHighlight && currentHighlight.text === citationSnippet) {
        return;
      }
      
      const timer = setTimeout(async () => {
        let targetPage: number | undefined;
        
        if (highlightedElementId) {
          const match = highlightedElementId.match(/(\d{4})$/);
          if (match) {
            targetPage = parseInt(match[1], 10) + 1; // PDF.js is 1-based
          }
        }
        
        const newHighlight = await createRectangleHighlight(
          citationSnippet, 
          viewer, 
          targetPage, 
          currentHighlight
        );
        
        if (newHighlight) {
          // Remove old highlight if it exists
          removeCurrentHighlight();
          setCurrentHighlight(newHighlight);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [citationSnippet, viewer, isLoading, highlightedElementId, currentHighlight, removeCurrentHighlight]);

  // Clean up highlight when citationSnippet becomes null
  useEffect(() => {
    if (!citationSnippet && currentHighlight) {
      removeCurrentHighlight();
    }
  }, [citationSnippet, currentHighlight, removeCurrentHighlight]);

  // Handle highlightedElementId changes after viewer is loaded
  useEffect(() => {
    if (highlightedElementId && viewer && !isLoading && numPages > 0) {
      const match = highlightedElementId.match(/(\d{4})$/);
      let pageNum = 1;
      if (match) {
        pageNum = parseInt(match[1], 10) + 1; // PDF.js is 1-based
      }
      
              // Validate page number is within bounds
        if (pageNum >= 1 && pageNum <= viewer.pagesCount) {
          viewer.currentPageNumber = Number(pageNum);
        
        setTimeout(() => {
          if (viewer) {
            const pageDiv = viewer.getPageView(pageNum - 1)?.div;
            if (pageDiv) {
              pageDiv.classList.add('highlighted');
              pageDiv.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }
          }
        }, 200);
      }
    }
  }, [highlightedElementId, viewer, isLoading, numPages]);

  // Update zoom level when it changes
  useEffect(() => {
    if (viewer && zoomLevel !== undefined) {
      if (typeof zoomLevel === 'string') {
        viewer.currentScaleValue = zoomLevel;
      } else {
        viewer.currentScale = zoomLevel;
      }
    }
  }, [viewer, zoomLevel]);

  // Clean up highlight on unmount
  useEffect(() => {
    return () => {
      if (currentHighlight) {
        removeHighlight(currentHighlight);
      }
    };
  }, [currentHighlight]);
  
  // Render for SSR
  if (!isBrowser) {
    return <PDFPlaceholder className={className} style={style} />;
  }

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Main content container - hidden while loading */}
      <div 
        ref={viewerContainerRef}
        className="w-full h-full"
        style={{ 
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
      />
      
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'white' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #475569',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
          <style>
            {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            `}
          </style>
          <div className="text-gray-600 font-medium text-lg mb-2">Loading PDF...</div>
          <div className="text-gray-400 text-sm">
            {numPages === 0 ? 'Preparing document...' : `Loading ${numPages} pages...`}
          </div>
        </div>
      )}
      
      {/* Error display */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'white' }}>
          <div style={{ marginBottom: '20px', color: '#dc2626' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#333' }}>
            Failed to Load PDF
          </h2>
          <p style={{ margin: '0 0 20px', color: '#666', textAlign: 'center' }}>
            {error}
          </p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
          <div className="mt-4 ml-2">
            <DownloadButton 
              onClick={handleDownload} 
              label="Download PDF" 
              primary={true}
            />
          </div>
        </div>
      )}
      
      {/* Page indicator and download button - only shown when document is loaded */}
      {(numPages > 0 && !error && !isLoading) && (
        <>
          <div className="absolute top-2 left-2 z-10">
            <PageIndicator 
              currentPage={currentPage} 
              totalPages={numPages} 
            />
          </div>
          
          <div className="absolute top-2 right-4 z-10">
            <DownloadButton onClick={handleDownload} />
          </div>
        </>
      )}
    </div>
  );
};

export default PDFViewer;