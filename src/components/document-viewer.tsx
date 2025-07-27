import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDocumentViewer } from '@contexts/document-viewer-context';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createRectangleHighlight, removeHighlight, type CurrentHighlight } from '@utils/pdf-highlighting';
import Loader from '@components/shared/loader';
import DownloadButton from '@components/shared/download-button';

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
    color: '#666'
  }}>
    PDF viewer loading...
  </div>
);

interface DocumentViewerProps {
  className?: string;
  style?: React.CSSProperties;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  className = 'w-full h-full',
  style,
}) => {
  const { 
    document: pdfDocument, 
    isLoading, 
    zoomLevel, 
    zoomIn, 
    zoomOut, 
    resetZoom,
    pageNumber,
    citationSnippet
  } = useDocumentViewer();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
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
    if (!pdfDocument?.originalFileUrl) return;
    
    fetch(pdfDocument.originalFileUrl)
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
          const urlObj = new URL(pdfDocument.originalFileUrl);
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
        window.open(pdfDocument.originalFileUrl, '_blank');
      });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            e.preventDefault();
            resetZoom();
            break;
        }
      }
    };
    
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetZoom]);

  // Handle wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.deltaY < 0 ? zoomIn() : zoomOut();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomIn, zoomOut]);

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
        }
      }
    };

    loadPdfJs();
    
    return () => {
      mounted = false;
    };
  }, [isBrowser]);

  // Load and render PDF when document changes and PDF.js is loaded
  useEffect(() => {
    if (!isBrowser || !pdfDocument?.originalFileUrl || !pdfJsLoaded || !viewerContainerRef.current) return;
    
    let mounted = true;
    let pdfViewerInstance: any = null;
    let pdfDocumentInstance: PDFDocumentProxy | null = null;
    let eventBusInstance: any = null;
    
    const loadAndRenderPdf = async () => {
      try {
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
          
          // Navigate to specific page if pageNumber is provided
          if (typeof pageNumber === 'number' && pdfViewerInstance && mounted) {
            const pageNum = pageNumber;
            if (pageNum >= 1 && pageNum <= pdfViewerInstance.pagesCount) {
              try {
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
              } catch (err) {
                console.warn('Failed to navigate to page:', pageNum, err);
              }
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
          url: pdfDocument.originalFileUrl,
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

        // Set zoom after document is loaded - with delay to ensure pages are ready
        if (pdfViewerInstance && zoomLevel !== undefined && pdfViewerInstance.pagesCount > 0) {
          setTimeout(() => {
            if (pdfViewerInstance && mounted && pdfViewerInstance.pagesCount > 0) {
              try {
                if (typeof zoomLevel === 'string') {
                  pdfViewerInstance.currentScaleValue = zoomLevel;
                } else {
                  pdfViewerInstance.currentScale = zoomLevel;
                }
              } catch (err) {
                // Silently handle zoom setting errors
                console.warn('Failed to set zoom level:', err);
              }
            }
          }, 100);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to load or render PDF: ${err instanceof Error ? err.message : String(err)}`);
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
  }, [pdfDocument?.originalFileUrl, pdfJsLoaded, zoomLevel, isBrowser, pageNumber]);

  // Handle text highlighting when citationSnippet changes
  useEffect(() => {
    if (citationSnippet && viewer && !isLoading) {
      // Check if we already have a highlight for this exact text
      if (currentHighlight && currentHighlight.text === citationSnippet) {
        return;
      }
      let targetPage: number | undefined;
      if (typeof pageNumber === 'number') {
        targetPage = pageNumber;
      }
      (async () => {
        const newHighlight = await createRectangleHighlight(
          citationSnippet, 
          viewer, 
          targetPage, 
          currentHighlight
        );
        if (newHighlight) {
          removeCurrentHighlight();
          setCurrentHighlight(newHighlight);
        }
      })();
    }
  }, [citationSnippet, viewer, isLoading, pageNumber, currentHighlight, removeCurrentHighlight]);

  // Clean up highlight when citationSnippet becomes null
  useEffect(() => {
    if (!citationSnippet && currentHighlight) {
      removeCurrentHighlight();
    }
  }, [citationSnippet, currentHighlight, removeCurrentHighlight]);

  // Handle pageNumber changes after viewer is loaded
  useEffect(() => {
    if (typeof pageNumber === 'number' && viewer && !isLoading && numPages > 0) {
      const pageNum = pageNumber;
      
      // Validate page number is within bounds
      if (pageNum >= 1 && pageNum <= viewer.pagesCount) {
        try {
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
        } catch (err) {
          console.warn('Failed to navigate to page:', pageNum, err);
        }
      }
    }
  }, [pageNumber, viewer, isLoading, numPages]);

  // Update zoom level when it changes
  useEffect(() => {
    if (viewer && zoomLevel !== undefined && viewer.pagesCount > 0) {
      try {
        if (typeof zoomLevel === 'string') {
          viewer.currentScaleValue = zoomLevel;
        } else {
          viewer.currentScale = zoomLevel;
        }
      } catch (err) {
        // Silently handle zoom setting errors
        console.warn('Failed to set zoom level:', err);
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

  if (!pdfDocument || isLoading) {
    return <Loader />;
  }

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`} 
      style={style}
      tabIndex={0}
    >
      {/* Floating page indicator - top left */}
      {numPages > 0 && (
        <div className="absolute z-20" style={{ top: '8px', left: '8px' }}>
          <div className="h-8 px-3 flex items-center justify-center text-sm bg-white/90 backdrop-blur-sm text-gray-700 font-medium rounded-md shadow-sm border border-gray-200/50">
            Page {currentPage} of {numPages}
          </div>
        </div>
      )}
      
      {/* Floating controls - top right */}
      <div className="absolute z-20" style={{ top: '8px', right: '16px' }}>
        <div className="flex items-center space-x-2">
          {/* Zoom out button */}
          <button
            onClick={zoomOut}
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm text-gray-700 rounded-md shadow-sm border border-gray-200/50 hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            title="Zoom out (Ctrl+-)"
          >
            -
          </button>
          
          {/* Zoom in button */}
          <button
            onClick={zoomIn}
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm text-gray-700 rounded-md shadow-sm border border-gray-200/50 hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            title="Zoom in (Ctrl+=)"
          >
            +
          </button>
          
          {/* Download button */}
          <DownloadButton onClick={handleDownload} />
        </div>
      </div>

      {/* Main content container */}
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
        <div className="absolute inset-0">
          <Loader />
        </div>
      )}
      
      {/* Error display */}
      {error && !isLoading && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-4" 
          style={{ 
            backgroundColor: 'white'
          }}
        >
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
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer; 