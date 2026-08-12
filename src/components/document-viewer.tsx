import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDocumentViewer } from '@contexts/document-viewer-context';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createRectangleHighlight, removeHighlight, type CurrentHighlight } from '@utils/pdf-highlighting';
import Loader from '@components/shared/loader';
import DownloadButton from '@components/shared/download-button';
import SearchBar from '@components/shared/search-bar';
import ToolbarButton from '@components/shared/toolbar-button';
import { SearchIcon } from '@components/shared/icons';
import {
  TOOLBAR_INSET,
  toolbarLabelStyle,
  toolbarRowStyle,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';
import useDocumentSearch from '@hooks/use-document-search';

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
  /** Adds a find-in-document control to the toolbar, opened with Ctrl/Cmd+F. */
  enableSearch?: boolean;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  className = 'w-full h-full',
  style,
  enableSearch = false,
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
  const [eventBus, setEventBus] = useState<any>(null);
  const [currentHighlight, setCurrentHighlight] = useState<CurrentHighlight | null>(null);

  const search = useDocumentSearch(eventBus);
  
  // Only run in browser
  const isBrowser = typeof window !== 'undefined';

  // Use pageNumber directly (backwards compatibility handled in context)
  const effectivePageNumber = pageNumber;

  // Add highlighting styles
  if (typeof window !== 'undefined' && !document.getElementById('pdf-rectangle-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'pdf-rectangle-highlight-style';
    style.textContent = `
      .pdf-rectangle-highlight {
        position: absolute !important;
        background: var(--captidejs-highlight-bg, rgba(255, 235, 59, 0.3)) !important;
        border: var(--captidejs-highlight-border, 2px solid #fdcb6e) !important;
        border-radius: var(--captidejs-highlight-radius, 3px) !important;
        pointer-events: none !important;
        z-index: var(--captidejs-highlight-z, 1000) !important;
        box-shadow: var(--captidejs-highlight-shadow, 0 2px 8px rgba(253, 203, 110, 0.3)) !important;
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


  const handleOpenSource = () => {
    if (!pdfDocument) return;

    const sourceUrl =
      typeof pdfDocument.metadata?.sourceURL === 'string' && pdfDocument.metadata.sourceURL.trim()
        ? pdfDocument.metadata.sourceURL
        : pdfDocument.originalFileUrl;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  };

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
      if (e.key === 'Escape' && enableSearch && search.isOpen) {
        e.preventDefault();
        search.close();
        return;
      }

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
          case 'f':
          case 'F':
            if (!enableSearch) break;
            e.preventDefault();
            search.open();
            break;
        }
      }
    };
    
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetZoom, enableSearch, search.isOpen, search.open, search.close]);

  // Withdrawing search has to clear its highlights; the bar itself is gone by then
  useEffect(() => {
    if (!enableSearch && search.isOpen) {
      search.close();
    }
  }, [enableSearch, search.isOpen, search.close]);

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
              inset: 0;
              width: 100%;
              height: 100%;
              overflow: auto;
            }
            .pdfViewer .page {
              margin: var(--captidejs-page-margin, 15px auto);
              box-shadow: var(--captidejs-page-shadow, 0 2px 5px rgba(0, 0, 0, 0.2));
              border: var(--captidejs-page-border, none);
              border-width: var(--captidejs-page-border-width, 0);
            }
            .pdfViewer .page.highlighted {
              box-shadow: var(--captidejs-page-highlight-shadow, 0 0 15px 5px rgba(255, 235, 59, 0.5));
            }
            /*
              PDF.js renders visible content to a canvas and selection/search highlights via an HTML text layer.
              Some apps/global CSS can accidentally offset the text layer; keep it anchored to the page.
            */
            .pdfViewer .textLayer {
              top: 0px !important;
              left: 0px !important;
            }
            /* Ensure text spans keep PDF.js expected positioning/metrics (defensive against global CSS). */
            .pdfViewer .textLayer > span {
              transform-origin: 0% 0% !important;
              line-height: 1 !important;
            }
            /* Override PDF.js search highlight colors to yellow */
            .pdfViewer .textLayer .highlight {
              background-color: var(--captidejs-find-highlight-bg, rgba(255, 235, 59, 0.3)) !important;
              color: inherit !important;
            }
            .pdfViewer .textLayer .highlight.selected {
              background-color: var(--captidejs-find-highlight-selected-bg, rgba(255, 235, 59, 0.5)) !important;
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
    let handlePagesInit: ((evt?: any) => void) | null = null;
    let handlePageChanging: ((evt: any) => void) | null = null;
    
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
        
        // Create find controller; it stays inert until a `find` event is dispatched
        const pdfFindController = new viewerModule.PDFFindController({
          linkService: pdfLinkService,
          eventBus: eventBusInstance,
          updateMatchesCountOnProgress: true,
        });
        
        // Create viewer
        pdfViewerInstance = new viewerModule.PDFViewer({
          container: viewerContainer,
          viewer: viewerElement,
          eventBus: eventBusInstance,
          linkService: pdfLinkService,
          findController: pdfFindController,
          // Use the non-enhanced text layer mode; it tends to be more reliable across PDFs and CSS environments.
          textLayerMode: 1,
          removePageBorders: false,
        });
        
        pdfLinkService.setViewer(pdfViewerInstance);
        
        // Set up event listeners
        handlePagesInit = () => {
          // A superseded load can still reach this point, and its viewer is gone
          if (!mounted) return;
          
          // Viewer is ready once pages are initialized
          setNumPages(pdfViewerInstance?.pagesCount || pdfDocumentInstance?.numPages || 0);
          setViewer(pdfViewerInstance);
          setEventBus(eventBusInstance);

          // Set initial zoom level
          if (pdfViewerInstance && zoomLevel !== undefined) {
            if (typeof zoomLevel === 'string') {
              pdfViewerInstance.currentScaleValue = zoomLevel;
            } else {
              pdfViewerInstance.currentScale = zoomLevel;
            }
          }
          
          // Navigate to specific page if pageNumber is provided
          if (typeof effectivePageNumber === 'number' && pdfViewerInstance && mounted) {
            const pageNum = effectivePageNumber;
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
        };
        
        handlePageChanging = (evt: any) => {
          if (mounted) {
            const pageNumber = parseInt(evt.pageNumber, 10) || 1;
            setCurrentPage(pageNumber);
          }
        };
        
        eventBusInstance.on('pagesinit', handlePagesInit);
        eventBusInstance.on('pagechanging', handlePageChanging);
        
        // Load the document
        const loadingTask = pdfjsLib.getDocument({
          url: pdfDocument.originalFileUrl,
          withCredentials: false,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          // Provide standard font data; missing font metrics are a common cause of misaligned text layer selection/highlights.
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });
        
        pdfDocumentInstance = await loadingTask.promise;
        
        if (!mounted || !pdfViewerInstance) return;
        
        // Set the document in the viewer
        pdfViewerInstance.setDocument(pdfDocumentInstance);
        pdfLinkService.setDocument(pdfDocumentInstance);

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
      // EventBus.off only removes a listener when given the same reference
      if (eventBusInstance) {
        if (handlePagesInit) eventBusInstance.off('pagesinit', handlePagesInit);
        if (handlePageChanging) eventBusInstance.off('pagechanging', handlePageChanging);
      }
      
      setEventBus(null);
      
      if (pdfDocumentInstance) {
        pdfDocumentInstance.destroy();
      }
    };
  }, [pdfDocument?.originalFileUrl, pdfJsLoaded, isBrowser, effectivePageNumber]);

  // Handle text highlighting when citationSnippet changes
  useEffect(() => {
    if (citationSnippet && viewer && !isLoading) {
      // Check if we already have a highlight for this exact text and it's still connected
      if (currentHighlight && 
          currentHighlight.text === citationSnippet && 
          currentHighlight.element.isConnected) {
        return;
      }
      
      // If highlight exists but is disconnected, remove it first
      if (currentHighlight && !currentHighlight.element.isConnected) {
        removeCurrentHighlight();
      }
      
      let targetPage: number | undefined;
      if (typeof effectivePageNumber === 'number') {
        targetPage = effectivePageNumber;
      }
      (async () => {
        const newHighlight = await createRectangleHighlight({
          searchText: citationSnippet,
          pdfViewerInstance: viewer,
          targetPage: targetPage,
          currentHighlight: currentHighlight,
        });
        if (newHighlight) {
          removeCurrentHighlight();
          setCurrentHighlight(newHighlight);
        }
      })();
    }
  }, [citationSnippet, viewer, isLoading, effectivePageNumber, currentHighlight, removeCurrentHighlight]);

  // Clean up highlight when citationSnippet becomes null
  useEffect(() => {
    if (!citationSnippet && currentHighlight) {
      removeCurrentHighlight();
    }
  }, [citationSnippet, currentHighlight, removeCurrentHighlight]);

  // Handle pageNumber changes after viewer is loaded
  useEffect(() => {
    if (typeof effectivePageNumber === 'number' && viewer && !isLoading && numPages > 0) {
      const pageNum = effectivePageNumber;
      
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
  }, [effectivePageNumber, viewer, isLoading, numPages]);

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

  // Handle highlight recreation specifically for zoom changes
  useEffect(() => {
    if (!currentHighlight || !citationSnippet || !viewer) return;
    
    // Only recreate if highlight is disconnected (DOM was recreated)
    if (!currentHighlight.element.isConnected) {
      console.log('Highlight disconnected after zoom, recreating...');
      
      // Recreate highlight without changing page navigation
      const recreateHighlight = async () => {
        const newHighlight = await createRectangleHighlight({
          searchText: citationSnippet,
          pdfViewerInstance: viewer,
          targetPage: currentHighlight?.page,
          currentHighlight,
          shouldNavigateOnMatch: false,
        });
        if (newHighlight) {
          removeCurrentHighlight();
          setCurrentHighlight(newHighlight);
        }
      };
      
      // Small delay to ensure page is fully rendered
      setTimeout(recreateHighlight, 100);
    }
  }, [zoomLevel, currentHighlight, citationSnippet, viewer, removeCurrentHighlight]);


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

  // PDF viewer
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`} 
      style={style}
      tabIndex={0}
    >
      {/* Top overlay row (aligned: page indicator | controls) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            ...toolbarRowStyle,
            justifyContent: 'space-between',
            padding: `${TOOLBAR_INSET}px`
          }}
        >
          {/* Left: page indicator */}
          <div style={{ flexShrink: 0, pointerEvents: 'auto' }}>
            {numPages > 0 && !search.isOpen && (
              <div style={{ ...toolbarSurfaceStyle, ...toolbarLabelStyle }}>
                Page {currentPage} of {numPages}
              </div>
            )}
          </div>

          {/* Right: find + open + zoom + download */}
          <div
            style={{
              ...toolbarRowStyle,
              flex: '1 1 auto',
              minWidth: 0,
              justifyContent: 'flex-end',
              pointerEvents: 'auto'
            }}
          >
            {enableSearch &&
              (search.isOpen ? (
                <SearchBar search={search} />
              ) : (
                <ToolbarButton onClick={search.open} title="Find in document">
                  <SearchIcon />
                </ToolbarButton>
              ))}
            <ToolbarButton
              onClick={handleOpenSource}
              title="Open in browser PDF viewer"
              style={{ width: 'auto', ...toolbarLabelStyle }}
            >
              Open
            </ToolbarButton>
            <ToolbarButton onClick={zoomOut} title="Zoom out (Ctrl+-)">
              -
            </ToolbarButton>
            <ToolbarButton onClick={zoomIn} title="Zoom in (Ctrl+=)">
              +
            </ToolbarButton>
            <DownloadButton onClick={handleDownload} />
          </div>
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
