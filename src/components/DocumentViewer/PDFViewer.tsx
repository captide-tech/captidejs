import React, { useRef, useEffect, useState } from 'react';
import { extractPageNumberFromElementId } from './utils/pageUtils';

// Import types from the pdfjs-dist package (using the types directory)
import type { PDFDocumentProxy } from 'pdfjs-dist';

// We'll declare these minimal interfaces to avoid import errors,
// while still providing type checking for our component
interface ViewerEventBus {
  on(eventName: string, listener: Function): void;
  off(eventName: string, listener?: Function): void;
}

interface ViewerLinkService {
  setDocument(pdfDocument: PDFDocumentProxy): void;
  setViewer(pdfViewer: ViewerPdfViewer): void;
}

interface ViewerPdfViewer {
  setDocument(pdfDocument: PDFDocumentProxy): void;
  currentScaleValue: number | string;
  currentPageNumber: number;
  getPageView(pageIndex: number): { div: HTMLElement } | undefined;
}

interface PDFViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
  zoomLevel: number;
  highlightedElementId?: string | null;
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
  zoomLevel = 1.0,
  highlightedElementId = null
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [viewer, setViewer] = useState<any>(null);
  
  // Only run in browser
  const isBrowser = typeof window !== 'undefined';
  
  // Initialize PDF.js in browser
  useEffect(() => {
    if (!isBrowser) return;
    let mounted = true;

    const loadPdfJs = async () => {
      try {
        console.log("Loading PDF.js libraries...");
        
        // Import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source
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
            .pdf-loading {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.9);
              z-index: 10;
            }
            .pdf-error {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.9);
              z-index: 10;
              padding: 20px;
              color: #d32f2f;
              text-align: center;
            }
            .pdf-page-indicator {
              position: absolute;
              bottom: 8px;
              right: 8px;
              background: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              z-index: 5;
              color: #333;
            }
          `;
          document.head.appendChild(customStyles);
        }
        
        if (mounted) {
          setPdfJsLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load PDF.js:", err);
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
        
        console.log(`Loading PDF from SAS URL: ${sasUrl.substring(0, 50)}...`);
        
        // Dynamic imports for viewer components
        const pdfjsLib = await import('pdfjs-dist');
        
        // Import the web viewer components (.mjs file extension is important)
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
        
        // Create viewer - using only options supported by PDFViewerOptions type
        // Use @ts-ignore to bypass TypeScript type checking since we're using dynamic imports
        // @ts-ignore
        pdfViewerInstance = new viewerModule.PDFViewer({
          container: viewerContainer,
          viewer: viewerElement,
          eventBus: eventBusInstance,
          linkService: pdfLinkService,
          textLayerMode: 2, // Enable text layer
          // Other options handled by our custom CSS
          removePageBorders: false,
        });
        
        pdfLinkService.setViewer(pdfViewerInstance);
        
        // Set up event listeners
        eventBusInstance.on('pagesinit', () => {
          // Set initial zoom level
          if (pdfViewerInstance) {
            pdfViewerInstance.currentScaleValue = zoomLevel;
          }
        });
        
        eventBusInstance.on('pagechanging', (evt: any) => {
          if (mounted) {
            setCurrentPage(evt.pageNumber || 1);
          }
        });
        
        // Load the document
        const loadingTask = pdfjsLib.getDocument({
          url: sasUrl,
          withCredentials: false,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });
        
        // Progress tracking
        loadingTask.onProgress = (data: { loaded: number; total: number }) => {
          if (data.total > 0) {
            const progress = Math.round((data.loaded / data.total) * 100);
            console.log(`Loading PDF: ${progress}%`);
          }
        };
        
        pdfDocumentInstance = await loadingTask.promise;
        
        if (!mounted || !pdfViewerInstance) return;
        
        // Set the document in the viewer
        pdfViewerInstance.setDocument(pdfDocumentInstance);
        pdfLinkService.setDocument(pdfDocumentInstance);
        
        setNumPages(pdfDocumentInstance.numPages);
        setViewer(pdfViewerInstance);
        
        console.log(`PDF loaded successfully: ${pdfDocumentInstance.numPages} pages`);
        
        // Check if we need to jump to a specific page based on highlightedElementId
        if (highlightedElementId) {
          const pageNumber = extractPageNumberFromElementId(highlightedElementId);
          if (pageNumber !== null) {
            // extractPageNumberFromElementId returns 0-indexed, but PDF.js uses 1-indexed
            const oneBasedPageNumber = pageNumber + 1;
            console.log(`Scrolling to highlighted page: ${pageNumber} (0-indexed) → ${oneBasedPageNumber} (1-indexed)`);
            
            // Wait for pages to render, then scroll
            setTimeout(() => {
              if (pdfViewerInstance && mounted) {
                pdfViewerInstance.currentPageNumber = oneBasedPageNumber;
                
                // Highlight the page
                setTimeout(() => {
                  if (mounted && pdfViewerInstance) {
                    const pageDiv = pdfViewerInstance.getPageView(pageNumber)?.div;
                    if (pageDiv) {
                      pageDiv.classList.add('highlighted');
                    }
                  }
                }, 100);
              }
            }, 100);
          }
          
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load or render PDF:", err);
        if (mounted) {
          setError(`Failed to load or render PDF: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (mounted) {
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

  // Update zoom level when it changes
  useEffect(() => {
    if (viewer && typeof zoomLevel === 'number') {
      viewer.currentScaleValue = zoomLevel;
    }
  }, [viewer, zoomLevel]);
  
  // Render for SSR
  if (!isBrowser) {
    return <PDFPlaceholder className={className} style={style} />;
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <div 
        ref={viewerContainerRef}
        className="w-full h-full"
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="pdf-loading">
          <div className="text-gray-600 font-medium text-lg mb-2">Loading PDF...</div>
          <div className="text-gray-400 text-sm">
            {numPages === 0 ? 'Preparing document...' : 'Rendering pages...'}
          </div>
        </div>
      )}
      
      {/* Error display */}
      {error && !isLoading && (
        <div className="pdf-error">
          <div className="text-red-600 font-bold text-lg mb-2">Failed to load PDF</div>
          <div className="text-gray-700 text-center max-w-md">{error}</div>
          {!pdfJsLoaded && (
            <div className="text-amber-600 text-sm mt-2">PDF.js could not be loaded. Please check your internet connection.</div>
          )}
          <div className="text-gray-500 text-sm mt-4 max-w-md overflow-hidden text-ellipsis">
            URL: {sasUrl ? sasUrl.substring(0, 50) + '...' : 'No URL provided'}
          </div>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      )}
      
      {/* Page indicator */}
      {(numPages > 0 && !error && !isLoading) && (
        <div className="pdf-page-indicator">
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
};

export default PDFViewer;