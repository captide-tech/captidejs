import React, { useEffect, useRef, useState } from 'react';
import { TooltipPosition } from './types';
import ShareableLinkTooltip from '../ShareableLinkTooltip';
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

interface HTMLViewerProps {
  document: any;
  highlightedElementId: string | null;
  zoomLevel: number;
  className?: string;
  style?: React.CSSProperties;
  enableShareableLinks?: boolean;
  shareableLinkBaseUrl?: string;
  shareableLinkButtonColor?: string;
  viewerRoutePath?: string;
}

/**
 * HTMLViewer Component
 * 
 * Renders an iframe containing HTML document content (SEC filings, 8-K documents, or earnings call transcripts)
 * and handles highlighting of specific elements.
 */
const HTMLViewer: React.FC<HTMLViewerProps> = ({
  document,
  highlightedElementId,
  zoomLevel,
  className = 'w-full h-full',
  style,
  enableShareableLinks = true,
  shareableLinkBaseUrl,
  shareableLinkButtonColor = '#2563eb',
  viewerRoutePath = 'document-viewer'
}) => {
  // Sharing is enabled if shareableLinkBaseUrl is provided AND enableShareableLinks is not explicitly false
  const areShareableLinksEnabled = !!shareableLinkBaseUrl && enableShareableLinks !== false;
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previousDocumentRef = useRef<string | null>(null);
  const previousSourceTypeRef = useRef<string | null>(null);
  const previousZoomLevelRef = useRef<number>(1.0);
  
  // State for the shareable link tooltip
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const [tooltipElementId, setTooltipElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Handle document loading and highlighting
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !document) return;

    // Set loading state
    setIsLoading(true);

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
        
        // Set loading to false after processing
        setIsLoading(false);
        return;
      }
      
      // Add styles for document types (for non-international filings)
      if (document.sourceType === '8-k' || isProxyStatement(document.sourceType)) {
        const style = iframeDocument.createElement('style');
        style.textContent = generatePageBasedDocumentStyles(zoomLevel);
        iframeDocument.head.appendChild(style);
        
        // Call page-based document specific handler
        handlePageBasedDocumentLoad(iframe, document, highlightedElementId);
        
        // Set loading to false after processing
        setIsLoading(false);
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
        
        // Set loading to false after all processing is done
        setIsLoading(false);
      }, 500); // Give time for all highlights to be applied
    };

    // Get HTML content based on document type
    let htmlContent: string;
    let documentIdentifier: string | null = null;
    
    htmlContent = document.htmlContent || '';
    documentIdentifier = document.sourceLink;
    
    // Special handling for 8-K documents only
    if (document.sourceType === '8-k') {
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

  // Handle closing the tooltip
  const closeTooltip = () => {
    setTooltipVisible(false);
  };

  // Show tooltip at the specified position
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

  const sourceTypeClass = document ? `captide-source-${document.sourceType.toLowerCase().replace(/\s/g, '-')}` : '';
  const html = document && document.htmlContent ? getBaseHtmlTemplate(document.htmlContent) : '';

  return (
    <div className="relative w-full h-full">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        className={`${className} ${sourceTypeClass}`}
        style={{
          ...style,
          border: 'none',
          opacity: isLoading ? 0 : 1, // Hide iframe until content is loaded
        }}
        title="Document Viewer"
      />
      
      {/* Loading spinner */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50"
          style={{
            zIndex: 10
          }}
        >
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
          <div className="text-gray-600 font-medium text-lg mb-2">Loading document...</div>
          <div className="text-gray-400 text-sm">Preparing content</div>
        </div>
      )}
      
      {areShareableLinksEnabled && shareableLinkBaseUrl && (
        <ShareableLinkTooltip
          isVisible={tooltipVisible}
          position={tooltipPosition}
          sourceLink={document?.sourceLink}
          elementId={tooltipElementId}
          baseUrl={shareableLinkBaseUrl}
          onClose={closeTooltip}
          buttonColor={shareableLinkButtonColor}
          viewerRoutePath={viewerRoutePath}
        />
      )}
    </div>
  );
};

export default HTMLViewer; 