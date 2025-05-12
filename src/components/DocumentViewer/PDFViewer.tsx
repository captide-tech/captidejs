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
 * Renders PDFs from SAS URLs with robust error handling
 */
const PDFViewer: React.FC<PDFViewerProps> = ({
  sasUrl,
  className = 'w-full h-full',
  style,
  zoomLevel = 1.0,
  highlightedElementId = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [pdfJsInitialized, setPdfJsInitialized] = useState(false);
  
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
        
        // Load pdf.js styles if not already loaded
        if (!document.getElementById('pdf-viewer-styles')) {
          const style = document.createElement('style');
          style.id = 'pdf-viewer-styles';
          style.textContent = `
            .pdf-container {
              width: 100%;
              height: 100%;
              overflow: auto;
              background: #f8f9fa;
              position: relative;
            }
            .pdf-page {
              margin: 10px auto;
              position: relative;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }
            .pdf-page.highlighted {
              box-shadow: 0 0 15px 5px rgba(255, 235, 59, 0.5);
            }
            .pdf-loading {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.8);
              z-index: 10;
            }
            .pdf-error {
              padding: 20px;
              color: #d32f2f;
              text-align: center;
            }
            .pdf-controls {
              position: absolute;
              bottom: 10px;
              right: 10px;
              background: white;
              padding: 5px;
              border-radius: 4px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
              z-index: 5;
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
    if (!isBrowser || !sasUrl || !pdfJsInitialized) return;
    
    let mounted = true;
    
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPdfDoc(null);
        setNumPages(0);
        setRenderedPages(new Set());
        
        console.log(`Loading PDF from SAS URL: ${sasUrl.substring(0, 50)}...`);
        
        // Import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Configure PDF.js for SAS URL
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
        const pdf = await loadingTask.promise;
        
        if (!mounted) return;
        
        console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
        
        // Immediately render the first page
        renderPage(pdf, 1);
        
        // If there's a highlighted element, navigate to it
        if (highlightedElementId) {
          const pageNumber = extractPageNumberFromElementId(highlightedElementId);
          if (pageNumber !== null && pageNumber < pdf.numPages) {
            setCurrentPage(pageNumber + 1); // Convert to 1-based
            renderPage(pdf, pageNumber + 1);
          }
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
    };
  }, [sasUrl, highlightedElementId, isBrowser, pdfJsInitialized]);
  
  // Navigate to highlighted element
  useEffect(() => {
    if (!isBrowser || !pdfDoc || !highlightedElementId) return;
    
    const pageNumber = extractPageNumberFromElementId(highlightedElementId);
    if (pageNumber === null) return;
    
    // Convert to 1-based page numbering
    const oneBasedPageNumber = pageNumber + 1;
    
    if (oneBasedPageNumber < 1 || oneBasedPageNumber > numPages) {
      console.warn(`Invalid page number: ${oneBasedPageNumber}`);
      return;
    }
    
    console.log(`Navigating to page ${oneBasedPageNumber}`);
    setCurrentPage(oneBasedPageNumber);
    
    // Render the page if not already rendered
    if (!renderedPages.has(oneBasedPageNumber)) {
      renderPage(pdfDoc, oneBasedPageNumber);
    }
    
    // Scroll to the page
    const pageElement = document.getElementById(`pdf-page-${oneBasedPageNumber}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Highlight the page
      document.querySelectorAll('.pdf-page').forEach(el => {
        el.classList.remove('highlighted');
      });
      pageElement.classList.add('highlighted');
    }
  }, [highlightedElementId, pdfDoc, numPages, renderedPages, isBrowser]);
  
  // Function to render a PDF page
  const renderPage = async (pdf: any, pageNumber: number) => {
    if (!containerRef.current || !pdf) return;
    
    try {
      setIsRendering(true);
      
      // If the page is already rendered, just scroll to it
      if (renderedPages.has(pageNumber)) {
        const pageElement = document.getElementById(`pdf-page-${pageNumber}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      
      console.log(`Rendering page ${pageNumber}`);
      
      // Get the page
      const page = await pdf.getPage(pageNumber);
      
      // Calculate viewport with zoom
      const viewport = page.getViewport({ scale: zoomLevel });
      
      // Find or create page container
      let pageContainer = document.getElementById(`pdf-page-${pageNumber}`);
      if (!pageContainer) {
        pageContainer = document.createElement('div');
        pageContainer.id = `pdf-page-${pageNumber}`;
        pageContainer.className = 'pdf-page';
        pageContainer.dataset.pageNumber = String(pageNumber);
        containerRef.current.appendChild(pageContainer);
      } else {
        // Clear existing content
        pageContainer.innerHTML = '';
      }
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get 2D context');
      }
      
      // Set dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;
      
      // Add canvas to container
      pageContainer.appendChild(canvas);
      
      // Render the page
      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport
      });
      
      await renderTask.promise;
      
      console.log(`Page ${pageNumber} rendered successfully`);
      
      // Mark page as rendered
      setRenderedPages(prev => {
        const newSet = new Set(prev);
        newSet.add(pageNumber);
        return newSet;
      });
      
      // Optimize memory by releasing page object
      page.cleanup();
    } catch (err) {
      console.error(`Failed to render page ${pageNumber}:`, err);
    } finally {
      setIsRendering(false);
    }
  };
  
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px',
          height: '100%',
          width: '100%',
          overflow: 'auto'
        }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-gray-600 font-medium text-lg mb-2">Loading PDF...</div>
          <div className="text-gray-400 text-sm">
            {!pdfDoc ? 'Preparing document...' : 'Rendering pages...'}
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
          {isRendering && <span className="ml-2 text-blue-500">⟳</span>}
        </div>
      )}
    </div>
  );
};

export default PDFViewer; 