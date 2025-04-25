import React, { useEffect, useRef, useState } from 'react';
import { useDocumentViewer } from '../../contexts/DocumentViewerContext';
import ShareableLinkTooltip from '../ShareableLinkTooltip';
import { DocumentViewerProps, TooltipPosition } from './types';
import { isInternationalFiling, processHtmlForPageBreaks, isProxyStatement } from './utils/documentProcessing';
import { highlightElementsInRange } from './utils/highlighting';
import { copyLinkToClipboard, setupShareableLinkButtons } from './utils/shareableLinks';
import { getBaseHtmlTemplate, generateGeneralStyles, generateInternationalFilingStyles, generatePageBasedDocumentStyles } from './styles';
import { 
  handleInternationalFilingHighlight, 
  handlePageBasedDocumentLoad 
} from './handlers/documentHandlers';

// Define the missing handler function locally to fix import issue
const handleStandardDocumentHighlight = (
  iframe: HTMLIFrameElement,
  document: any,
  highlightedElementId: string | null,
  isNewDocument: boolean,
  highlightElementsInRangeFn: (range: Range, commonAncestor: Element, iframeDocument: Document) => void
): void => {
  const iframeDocument = iframe.contentDocument;
  if (!iframeDocument) return;

  // Remove existing highlights
  const existingHighlights = iframeDocument.querySelectorAll('.highlighted');
  existingHighlights.forEach(el => {
    el.classList.remove('highlighted');
  });

  if (highlightedElementId) {
    const cleanId = highlightedElementId.replace('#', '');
    
    // Delay based on whether this is a new document or not
    const delay = isNewDocument ? 500 : 0;

    setTimeout(() => {
      // Find all elements with matching ID
      const elementsToHighlight = iframeDocument.querySelectorAll(
        `[unique_id*="${cleanId}"], [unique-id*="${cleanId}"], [unique-id*="#${cleanId}"], [id*="[#${cleanId}]"]`
      );

      if (elementsToHighlight.length > 0) {
        // Highlight all directly matching elements
        elementsToHighlight.forEach(element => {
          element.classList.add('highlighted');
        });
        
        // Find a good element to scroll to
        const bestElement = elementsToHighlight[0];
        if (bestElement) {
          // Simple version - just scroll to the first highlighted element
          bestElement.scrollIntoView({
            behavior: isNewDocument ? 'auto' : 'smooth',
            block: 'center'
          });
        }
      }
    }, delay);
  }
};

/**
 * DocumentViewer Component
 * 
 * Renders an iframe containing document content (SEC filings, 8-K documents, or earnings call transcripts)
 * and handles highlighting of specific elements.
 * 
 * Features:
 * - Support for all document types (10-K/10-Q filings, 8-K documents, and earnings call transcripts)
 * - Support for international filings (20-F, 40-F, and 6-K documents) with comment-based highlighting
 * - Smart element highlighting with clustering
 * - Efficient document reloading on content change
 * - Zoom controls for adjusting document scale
 * - Hover-to-share functionality for highlighted elements
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
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previousDocumentRef = useRef<string | null>(null);
  const previousSourceTypeRef = useRef<string | null>(null);
  const previousZoomLevelRef = useRef<number>(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for the shareable link tooltip
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const [tooltipElementId, setTooltipElementId] = useState<string | null>(null);

  // Apply zoom level to the iframe content without re-rendering or reloading the document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) return;
    
    // Only update if the zoom level has changed
    if (previousZoomLevelRef.current !== zoomLevel) {
      const iframeDocument = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      
      // Apply zoom using transform scale on the body
      if (iframeDocument.body) {
        // Calculate visible area dimensions
        const viewportHeight = iframeWindow.innerHeight;
        const viewportWidth = iframeWindow.innerWidth;
        
        // Store current scroll position
        const scrollX = iframeWindow.scrollX;
        const scrollY = iframeWindow.scrollY;
        
        // Calculate the center point of the current viewport in document coordinates
        const centerX = scrollX + (viewportWidth / 2);
        const centerY = scrollY + (viewportHeight / 2);
        
        // Calculate how the center point will change after scaling
        const scaleFactor = zoomLevel / previousZoomLevelRef.current;
        
        // Apply the zoom transformation
        iframeDocument.body.style.transformOrigin = 'top left';
        iframeDocument.body.style.transform = `scale(${zoomLevel})`;
        iframeDocument.body.style.width = `${100 / zoomLevel}%`;
        iframeDocument.body.style.height = 'auto'; // Allow height to adjust naturally
        iframeDocument.body.style.minHeight = '100%';
        
        // Calculate new scroll position to keep the same point centered
        const newCenterX = centerX * scaleFactor;
        const newCenterY = centerY * scaleFactor;
        
        // Calculate new scroll position (accounting for current viewport size)
        const newScrollX = newCenterX - (viewportWidth / 2);
        const newScrollY = newCenterY - (viewportHeight / 2);
        
        // Add a slight delay to ensure the transform has been applied
        setTimeout(() => {
          // Scroll to the new position to maintain the same content in view
          iframeWindow.scrollTo({
            left: newScrollX,
            top: newScrollY,
            behavior: 'auto' // Use instant scroll to prevent jarring shift
          });
          
          // Trigger a resize event to recalculate content layout
          const resizeEvent = new Event('resize');
          iframeWindow.dispatchEvent(resizeEvent);
        }, 10);
      }
      
      previousZoomLevelRef.current = zoomLevel;
    }
  }, [zoomLevel]); // Only depend on zoomLevel, not document or highlightedElementId

  // Handle document loading and highlighting
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !document) return;

    // General document load handler
    const handleLoad = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) return;

      // Handle international filings differently - preserve original structure
      if (isInternationalFiling(document.sourceType)) {
        // Add only minimal styles for highlighting
        const style = iframeDocument.createElement('style');
        style.textContent = `
          .highlighted {
            background-color: yellow !important;
          }
          .highlighted * {
            background-color: transparent !important;
          }
          .first-highlighted {
            margin-top: 12px !important;
          }
        `;
        iframeDocument.head.appendChild(style);
        
        // Apply zoom manually
        if (zoomLevel !== 1) {
          const zoomStyle = iframeDocument.createElement('style');
          zoomStyle.textContent = `
            body {
              transform-origin: top left;
              transform: scale(${zoomLevel});
              width: ${100 / zoomLevel}%;
            }
          `;
          iframeDocument.head.appendChild(zoomStyle);
        }
        
        // Call international filing specific handler
        handleInternationalFilingHighlight(iframe, highlightedElementId);
        
        // Setup shareable link buttons
        setupShareableLinkButtons(
          iframeRef, 
          shareableLinkButtonColor, 
          document, 
          highlightedElementId, 
          areShareableLinksEnabled
        );
        
        return;
      }
      
      // Add styles for document types (for non-international filings)
      if (document.sourceType === '8-K' || isProxyStatement(document.sourceType)) {
        const style = iframeDocument.createElement('style');
        style.textContent = generatePageBasedDocumentStyles(zoomLevel);
        iframeDocument.head.appendChild(style);
        
        // Call page-based document specific handler
        handlePageBasedDocumentLoad(iframe, document, highlightedElementId);
        return;
      }

      // Handle standard document types (10-K, 10-Q, transcripts)
      handleStandardDocumentHighlight(
        iframe, 
        document, 
        highlightedElementId, 
        previousDocumentRef.current !== document.sourceLink || 
          previousSourceTypeRef.current !== document.sourceType,
        highlightElementsInRange
      );

      // Add general styles for all document types
      const generalStyle = iframeDocument.createElement('style');
      generalStyle.textContent = generateGeneralStyles(zoomLevel);
      iframeDocument.head.appendChild(generalStyle);

      // Setup shareable link buttons after all other processing
      setTimeout(() => {
        setupShareableLinkButtons(
          iframeRef, 
          shareableLinkButtonColor, 
          document, 
          highlightedElementId, 
          areShareableLinksEnabled
        );
      }, 500); // Give time for all highlights to be applied
    };

    // Get HTML content based on document type
    let htmlContent: string;
    let documentIdentifier: string | null = null;
    
    htmlContent = document.htmlContent || '';
    documentIdentifier = document.sourceLink;
    
    // Special handling for 8-K documents only
    if (document.sourceType === '8-K') {
      htmlContent = processHtmlForPageBreaks(htmlContent);
    }
    
    // For international filings (especially 20-F), use a different approach
    let formattedHtmlContent: string;
    
    if (isInternationalFiling(document.sourceType)) {
      // Preserve the original HTML structure completely for international filings
      // Only add minimal head content to allow highlighting and zoom
      formattedHtmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <base target="_blank">
            <script>
              // Simple resize handler
              window.addEventListener('resize', function() {
                if (window.parent) {
                  window.parent.postMessage({ type: 'resize', height: document.body.scrollHeight }, '*');
                }
              });
              
              // Report document height after load
              window.addEventListener('load', function() {
                setTimeout(function() {
                  if (window.parent) {
                    window.parent.postMessage({ type: 'resize', height: document.body.scrollHeight }, '*');
                  }
                }, 100);
              });
            </script>
          </head>
          <body>${htmlContent}</body>
        </html>
      `;
    } else {
      // For standard documents, use the regular template
      formattedHtmlContent = getBaseHtmlTemplate(htmlContent);
    }

    // Check if we're loading a new document or just updating the highlight in the same document
    const isDocumentChange = previousDocumentRef.current !== documentIdentifier || 
                           previousSourceTypeRef.current !== document.sourceType;

    if (isDocumentChange) {
      // Only reset the iframe content if we're loading a new document
      iframe.srcdoc = formattedHtmlContent;
      previousDocumentRef.current = documentIdentifier;
      previousSourceTypeRef.current = document.sourceType;
    } else {
      // For the same document with a new highlight, just handle the highlighting
      handleLoad();
    }

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [document, highlightedElementId, zoomLevel, areShareableLinksEnabled, shareableLinkButtonColor]);

  // Apply hover handlers when highlighting changes
  useEffect(() => {
    // Give time for highlighting to be applied
    const timeoutId = setTimeout(() => {
      setupShareableLinkButtons(
        iframeRef, 
        shareableLinkButtonColor, 
        document, 
        highlightedElementId, 
        areShareableLinksEnabled
      );
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [highlightedElementId, document, areShareableLinksEnabled, shareableLinkButtonColor]);

  // Close the tooltip
  const closeTooltip = () => {
    setTooltipVisible(false);
    setTooltipElementId(null);
  };

  // Set tooltip visibility
  const showTooltip = (position: TooltipPosition, elementId: string) => {
    setTooltipPosition(position);
    setTooltipElementId(elementId);
    setTooltipVisible(true);
  };

  // Add event listener to handle clicks outside tooltip to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipVisible) {
        // Only close if click is not inside the tooltip itself
        const tooltipContainer = window.document.querySelector('.shareable-link-tooltip-container');
        if (tooltipContainer && !tooltipContainer.contains(event.target as Node)) {
          closeTooltip();
        }
      }
    };
    
    window.document.addEventListener('click', handleClickOutside);
    return () => {
      window.document.removeEventListener('click', handleClickOutside);
    };
  }, [tooltipVisible]);

  // Add a resize listener in the parent component
  useEffect(() => {
    const handleIframeResize = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize') {
        // You could adjust the container or iframe height here if needed
      }
    };
    
    window.addEventListener('message', handleIframeResize);
    return () => {
      window.removeEventListener('message', handleIframeResize);
    };
  }, []);

  // Ensure scrolling works regardless of focus
  useEffect(() => {
    const containerElement = containerRef.current;
    const iframeElement = iframeRef.current;
    
    if (!containerElement || !iframeElement) return;
    
    // Function to handle scroll events from the container
    const handleContainerScroll = (event: WheelEvent) => {
      // If the iframe content document isn't loaded yet, don't do anything
      if (!iframeElement.contentWindow || !iframeElement.contentDocument) return;
      
      // Prevent default to avoid parent scrolling
      event.preventDefault();
      
      // Calculate the scroll amount
      const scrollAmount = event.deltaY;
      
      // Scroll the iframe content
      iframeElement.contentWindow.scrollBy({
        top: scrollAmount,
        behavior: 'auto'
      });
    };
    
    // Add scroll event listener to the container
    containerElement.addEventListener('wheel', handleContainerScroll, { passive: false });
    
    // Clean up event listener on unmount
    return () => {
      containerElement.removeEventListener('wheel', handleContainerScroll);
    };
  }, []);
  
  // Auto-focus the iframe when content changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !document) return;
    
    // Give focus to the iframe for better scroll behavior
    iframe.addEventListener('load', () => {
      // Focus after a short delay to ensure content is ready
      setTimeout(() => {
        if (iframe.contentWindow) {
          // Try to focus the iframe window
          iframe.contentWindow.focus();
        }
      }, 200);
    });
  }, [document]);

  if (isLoading) {
    return <div className={className} style={style}></div>;
  }

  if (!document) {
    return <div className={className} style={style}></div>;
  }

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full group"
      // Add touch events handler for mobile devices
      onTouchStart={() => {
        // Focus the iframe when user touches the container
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.focus();
        }
      }}
    >
      {showZoomControls && (
        <div className="absolute mt-2 top-12 right-2 z-10 flex items-center space-x-1 bg-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 border border-gray-300">
          <button 
            onClick={zoomOut}
            className="p-1 hover:bg-gray-100 rounded"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          
          <button 
            onClick={zoomIn}
            className="p-1 hover:bg-gray-100 rounded"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
        </div>
      )}
      
      {/* Shareable Link Tooltip */}
      {areShareableLinksEnabled && document && (
        <ShareableLinkTooltip
          isVisible={tooltipVisible}
          position={tooltipPosition}
          sourceLink={document.sourceLink}
          elementId={tooltipElementId}
          baseUrl={shareableLinkBaseUrl}
          onClose={closeTooltip}
          buttonColor={shareableLinkButtonColor}
          viewerRoutePath={viewerRoutePath}
        />
      )}
      
      <iframe
        ref={iframeRef}
        className={className}
        style={{
          ...style,
          width: '100%',
          height: '100%',
          overflow: 'auto',
        }}
        sandbox="allow-same-origin allow-popups allow-scripts allow-forms"
        // Add a tabIndex to make the iframe focusable by keyboard
        tabIndex={0}
      />
    </div>
  );
};

export default DocumentViewer; 