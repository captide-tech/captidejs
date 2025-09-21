import React, { useEffect, useRef, useState } from 'react';
import { 
  handleInternationalFilingHighlight, 
  handlePageBasedDocumentLoad,
  handleStandardDocumentHighlight
} from '@utils/document-handlers';
import { highlightElementsInRange } from '@utils/highlighting';
import { isInternationalFiling, processHtmlForPageBreaks, isProxyStatement } from '@utils/document-processing';


interface HTMLViewerProps {
  document: any;
  highlightedElementId: string | null;
  zoomLevel: number;
  className?: string;
  style?: React.CSSProperties;
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
  style
}) => {
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previousDocumentRef = useRef<string | null>(null);
  const previousSourceTypeRef = useRef<string | null>(null);
  const previousZoomLevelRef = useRef<number>(1.0);
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

      // Add basic styles for highlighting and zoom
      const style = iframeDocument.createElement('style');
      style.textContent = `
        .highlighted {
          background-color: yellow !important;
        }
        .highlighted * {
          background-color: transparent !important;
        }
        
        /* Ensure white background */
        html, body {
          background-color: white !important;
        }
        
        /* Apply zoom */
        body {
          transform-origin: top left;
          transform: scale(${zoomLevel});
          width: ${100 / zoomLevel}%;
        }
      `;
      iframeDocument.head.appendChild(style);
      
      // Apply proper document handling based on document type
      if (highlightedElementId) {
        // Check if this is an international filing
        if (isInternationalFiling(document.formType)) {
          handleInternationalFilingHighlight(iframe, highlightedElementId);
        }
        // Check if this is a page-based document (8-K or proxy statement)
        else if (document.formType?.toUpperCase() === '8-K' || isProxyStatement(document.formType)) {
          handlePageBasedDocumentLoad(iframe, document, highlightedElementId);
        }
        // Standard document highlighting for other types
        else {
          handleStandardDocumentHighlight(iframe, document, highlightedElementId, true, highlightElementsInRange);
        }
      }
      
      // Set loading to false after processing
      setIsLoading(false);
    };

    // Get HTML content and process it based on document type
    let htmlContent = document.metadata?.htmlContent || '';
    
    // Process HTML for 8-K documents to add page containers
    if (document.formType?.toUpperCase() === '8-K') {
      htmlContent = processHtmlForPageBreaks(htmlContent);
    } else {
      // For other documents, wrap in basic HTML structure
      htmlContent = `
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
    }
    
    // For 8-K documents, the HTML is already processed with proper structure
    const formattedHtmlContent = document.formType?.toUpperCase() === '8-K' 
      ? htmlContent 
      : htmlContent;

    // Set the iframe content
    iframe.srcdoc = formattedHtmlContent;
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [document, highlightedElementId, zoomLevel]);


  // Add a resize listener in the parent component
  useEffect(() => {
    const handleIframeResize = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize') {
        // You could adjust the container or iframe height here if needed
      }
    };
    
    window.addEventListener('message', handleIframeResize);
    
    // Add a ResizeObserver to handle container size changes
    // This helps with resizable panels
    const containerElement = iframeRef.current?.parentElement;
    if (containerElement && window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        // Force iframe to refresh its layout
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.dispatchEvent(new Event('resize'));
        }
      });
      
      resizeObserver.observe(containerElement);
      
      return () => {
        window.removeEventListener('message', handleIframeResize);
        resizeObserver.disconnect();
      };
    }
    
    return () => {
      window.removeEventListener('message', handleIframeResize);
    };
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: 'white' }}>
      <iframe
        ref={iframeRef}
        className={className}
        style={{
          ...style,
          border: 'none',
          opacity: isLoading ? 0 : 1, // Hide iframe until content is loaded
          width: '100%',
          height: '100%',
          overflow: 'auto',
          background: 'white',
          display: 'block', // Ensure block display for full width
          maxWidth: '100%', // Limit to container width
          transition: 'opacity 0.3s ease' // Smooth transition when loading completes
        }}
        title="Document Viewer"
      />
      
      {/* Loading spinner */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            zIndex: 10,
            backgroundColor: 'white'
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
    </div>
  );
};

export default HTMLViewer;
