import React, { useRef, useEffect, useState } from 'react';
import { extractPageNumberFromElementId } from './utils/pageUtils';

// We're not importing PDF.js statically anymore
// This will be dynamically loaded only in browser environments

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
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfJsInitialized, setPdfJsInitialized] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Only run in browser
  const isBrowser = typeof window !== 'undefined';
  
  // Initialize PDF.js in browser
  useEffect(() => {
    if (!isBrowser) return;

    // We're only initializing - no need to return a cleanup
    const initialize = async () => {
      try {
        console.log("Initializing PDF.js and loading worker...");
        // Import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source
        const { GlobalWorkerOptions } = await import('pdfjs-dist');
        
        // Use explicit HTTPS URL with exact version number and correct file extension (.mjs)
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        GlobalWorkerOptions.workerSrc = workerUrl;
        console.log(`PDF.js initialized with worker from: ${workerUrl}`);
        
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
        
        // Load PDF.js styles if not already loaded
        if (!document.getElementById('pdf-viewer-styles')) {
          const link = document.createElement('link');
          link.id = 'pdf-viewer-styles';
          link.rel = 'stylesheet';
          link.href = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/web/pdf_viewer.css`;
          document.head.appendChild(link);
          
          // Add additional styles needed for PDF.js viewer
          const style = document.createElement('style');
          style.id = 'pdf-viewer-custom-styles';
          style.textContent = `
            .pdfViewer .page {
              margin: 1px auto -8px auto;
              border: 1px solid #eee;
            }
            .pdfViewer.removePageBorders .page {
              margin: 0 auto 10px auto;
              border: none;
            }
          `;
          document.head.appendChild(style);
        }
        
        // Mark PDF.js as initialized
        setPdfJsInitialized(true);
      } catch (err) {
        console.error("Failed to initialize PDF.js:", err);
        setError(`Failed to initialize PDF.js: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    initialize();
  }, [isBrowser]);

  // Load PDF when sasUrl changes and PDF.js is initialized
  useEffect(() => {
    if (!isBrowser || !sasUrl || !pdfJsInitialized || !containerRef.current) return;
    
    let mounted = true;
    let viewer: any = null;
    
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`Loading PDF from SAS URL: ${sasUrl.substring(0, 50)}...`);
        
        // Import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Get the PDF.js viewer components using a more dynamic approach to avoid TS errors
        // This avoids the need for type declarations
        // @ts-ignore - Dynamically access the module without type checking
        const pdfJsViewer = window.pdfjsViewer || await new Promise((resolve) => {
          // Load the viewer script dynamically
          const script = document.createElement('script');
          script.src = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/web/pdf_viewer.js`;
          script.onload = () => {
            // @ts-ignore - Access the global pdfjsViewer object
            resolve(window.pdfjsViewer);
          };
          script.onerror = (e) => {
            console.error('Failed to load PDF.js viewer:', e);
            setError('Failed to load PDF.js viewer script');
          };
          document.head.appendChild(script);
        });
        
        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          
          // Ensure container has position: absolute as required by PDF.js
          containerRef.current.style.position = 'absolute';
          containerRef.current.style.top = '0';
          containerRef.current.style.left = '0';
          containerRef.current.style.right = '0';
          containerRef.current.style.bottom = '0';
        }
        
        // Create viewer container
        const viewerContainer = document.createElement('div');
        viewerContainer.className = 'pdfViewer';
         
        if (containerRef.current) {
          containerRef.current.appendChild(viewerContainer);
           
          // Create event bus
          const eventBus = new pdfJsViewer.EventBus();
           
          // Create link service
          const linkService = new pdfJsViewer.PDFLinkService({
            eventBus,
          });
            
          // Create viewer instance
          viewer = new pdfJsViewer.PDFViewer({
            container: containerRef.current,
            eventBus,
            linkService,
            renderer: 'canvas',
            textLayerMode: 2, // Enable text layer
            removePageBorders: true, // Cleaner look without borders
          });
            
          viewerRef.current = viewer;
          linkService.setViewer(viewer);
            
          // Configure PDF.js for SAS URL with better caching
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
          
          // Load the document
          const pdfDocument = await loadingTask.promise;
          
          if (!mounted) return;
          
          console.log(`PDF loaded successfully: ${pdfDocument.numPages} pages`);
          setNumPages(pdfDocument.numPages);
          setPdfDocument(pdfDocument);
          
          // Set the document in the viewer
          viewer.setDocument(pdfDocument);
          linkService.setDocument(pdfDocument);
          
          // Update the page scale (zoom)
          viewer.currentScaleValue = zoomLevel;
          
          // Handle page change events
          eventBus.on('pagechanging', (evt: any) => {
            if (mounted) {
              setCurrentPage(evt.pageNumber);
            }
          });
          
          // If there's a highlighted element, navigate to it
          if (highlightedElementId) {
            const pageNumber = extractPageNumberFromElementId(highlightedElementId);
            if (pageNumber !== null && pageNumber < pdfDocument.numPages) {
              const pageIndex = pageNumber; // PDF.js uses 0-based indexing internally
              viewer.currentPageNumber = pageIndex + 1; // But the viewer uses 1-based indexing
            }
          }
          
          setIsLoading(false);
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error("Failed to load PDF:", err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };
    
    loadPdf();
    
    return () => {
      mounted = false;
      if (viewer) {
        // Clean up viewer resources
        try {
          viewer.cleanup();
        } catch (err) {
          console.error('Error cleaning up PDF viewer:', err);
        }
      }
    };
  }, [sasUrl, pdfJsInitialized, isBrowser]);
  
  // Handle zoom level changes
  useEffect(() => {
    if (!viewerRef.current || !pdfDocument) return;
    
    // Update the page scale (zoom)
    viewerRef.current.currentScaleValue = zoomLevel;
    
  }, [zoomLevel, pdfDocument]);
  
  // Navigate to highlighted element
  useEffect(() => {
    if (!isBrowser || !pdfDocument || !viewerRef.current || !highlightedElementId) return;
    
    const pageNumber = extractPageNumberFromElementId(highlightedElementId);
    if (pageNumber === null) return;
    
    // Convert to 1-based page numbering for the viewer
    const oneBasedPageNumber = pageNumber + 1;
    
    if (oneBasedPageNumber < 1 || oneBasedPageNumber > numPages) {
      console.warn(`Invalid page number: ${oneBasedPageNumber}`);
      return;
    }
    
    console.log(`Navigating to page ${oneBasedPageNumber}`);
    viewerRef.current.currentPageNumber = oneBasedPageNumber;
    
  }, [highlightedElementId, pdfDocument, numPages, isBrowser]);
  
  // Render for SSR
  if (!isBrowser) {
    return <PDFPlaceholder className={className} style={style} />;
  }

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef}
        className={`pdf-container ${className}`}
        style={{
          ...style,
          position: 'absolute', // Required by PDF.js
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'auto'
        }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-gray-600 font-medium text-lg mb-2">Loading PDF...</div>
          <div className="text-gray-400 text-sm">
            {!pdfDocument ? 'Preparing document...' : 'Rendering pages...'}
          </div>
        </div>
      )}
      
      {/* Error display */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 p-4 z-10">
          <div className="text-red-600 font-bold text-lg mb-2">Failed to load PDF</div>
          <div className="text-gray-700 text-center max-w-md">{error}</div>
          {!pdfJsInitialized && (
            <div className="text-amber-600 text-sm mt-2">PDF.js worker could not be loaded. Please check your internet connection.</div>
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
      {(numPages > 0 && !error) && (
        <div className="absolute bottom-2 right-2 bg-white bg-opacity-85 px-2 py-1 rounded text-xs font-medium text-gray-700 z-20 shadow-sm">
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
};

export default PDFViewer; 