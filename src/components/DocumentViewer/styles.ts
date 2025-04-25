/**
 * Generate general document styles that apply to all document types
 */
export const generateGeneralStyles = (zoomLevel: number): string => `
  /* Base container styles */
  html, body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    margin: 0;
    padding: 0;
  }
  
  /* Allow natural wrapping while preventing horizontal overflow */
  body * {
    max-width: 100%;
    box-sizing: border-box;
  }
  
  /* Handle tables more naturally */
  table {
    max-width: 100%;
    table-layout: auto;
    width: auto;
  }
  
  /* Allow tables to wrap - less aggressive approach */
  table, thead, tbody, th, td {
    max-width: 100%;
    overflow-wrap: break-word;
  }
  
  /* Financial document tables often need special handling */
  .ix_hidden, .previewer-table, .financial-table {
    max-width: 100%;
    width: auto !important;
  }
  
  /* For numeric data columns, preserve as much as possible */
  td[align="right"], th[align="right"] {
    white-space: nowrap;
    text-align: right;
  }
  
  /* Make images responsive */
  img {
    max-width: 100%;
    height: auto;
  }
  
  /* Special handling for pages in proxy statement documents */
  .captide-page {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  
  /* Only override inline widths that are too large */
  [style*="width:"] {
    max-width: 100%;
  }
  
  /* Highlighted elements */
  .highlighted {
    background-color: yellow !important;
  }
  .highlighted * {
    background-color: transparent !important;
  }
`;

/**
 * Styles for 8-K and proxy statement documents
 */
export const generatePageBasedDocumentStyles = (zoomLevel: number): string => `
  .page-highlighted {
    outline: 4px solid yellow;
    outline-offset: -4px;
  }
  .page-container {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #ddd;
    background-color: white;
  }
  
  /* Styles for proxy statement documents with captide-page markers */
  .captide-page-highlighted {
    outline: 4px solid yellow;
    outline-offset: -4px;
  }
  .captide-page {
    margin-bottom: 10px;
    padding: 10px;
    background-color: white;
    position: relative;
  }
  
  /* Responsive layout styles */
  body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    overflow-x: auto;
  }
  
  /* Improve table rendering */
  table {
    max-width: 100%;
    table-layout: auto;
  }
`;

/**
 * Styles for international filings (20-F, 40-F, 6-K, S-1)
 * Modified to be much less invasive and preserve original document formatting
 */
export const generateInternationalFilingStyles = (zoomLevel: number): string => `
  /* Only apply minimal necessary styling for international filings */
  body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    margin: 0 !important;
    padding: 0 !important;
    background-color: white;
  }
  
  /* Prevent page overlapping issues for XBRL documents */
  body > div {
    position: relative !important;
    page-break-after: always;
    margin-bottom: 20px;
  }
  
  /* Force page content to have proper height and position */
  div[style*="height: 792pt"],
  div[style*="height:792pt"],
  div[style*="height: 841pt"],
  div[style*="height:841pt"] {
    height: auto !important;
    min-height: 792pt;
    overflow: visible !important;
    margin-bottom: 30px !important;
    position: relative !important;
    page-break-after: always;
  }
  
  /* Apply typical page sizes for US Letter and A4 */
  div[style*="width: 612pt"],
  div[style*="width:612pt"] {
    width: 612pt;
    margin-left: auto;
    margin-right: auto;
  }
  
  /* Highlighted elements */
  .highlighted {
    background-color: yellow !important;
  }
  
  .highlighted * {
    background-color: transparent !important;
  }
  
  /* Ensure text nodes wrapped in spans display properly */
  span.highlighted {
    background-color: yellow !important;
  }
  
  /* Ensure absolute positioning works correctly but contained in parents */
  [style*="position: absolute"],
  [style*="position:absolute"] {
    position: absolute !important;
    max-width: 100%;
  }
  
  /* Preserve all original styles */
  [style] {
    max-width: none !important;
  }
  
  /* Ensure nested highlighted elements work properly */
  .highlighted .highlighted {
    background-color: transparent !important;
  }
  
  /* First highlighted element gets margin for button positioning */
  .first-highlighted {
    margin-top: 12px !important;
  }
`;

/**
 * Styles for the shareable link button
 */
export const generateShareableLinkButtonStyles = (buttonColor: string): string => `
  .shareable-link-button {
    position: absolute !important;
    top: -10px !important;
    left: 5px !important;
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
    min-height: 28px !important;
    background-color: ${buttonColor} !important;
    color: white !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    border: 2px solid white !important;
    z-index: 100000 !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
    transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease, background-color 0.2s ease !important;
    pointer-events: auto !important;
    opacity: 0 !important;
    visibility: hidden !important;
  }
  
  /* Show the button when hovering over ANY highlighted element */
  .highlighted:hover ~ .shareable-link-button,
  .highlighted:hover .shareable-link-button,
  .page-highlighted:hover .shareable-link-button {
    opacity: 0.9 !important;
    visibility: visible !important;
    background-color: ${buttonColor} !important;
  }
  
  .shareable-link-button:hover {
    background-color: ${buttonColor === '#2563eb' ? '#1d4ed8' : buttonColor} !important;
    transform: scale(1.1) !important;
    opacity: 1 !important;
  }

  .highlighted {
    position: relative !important;
    padding-left: 5px !important;
  }
  
  .first-highlighted {
    margin-top: 12px !important;
  }
`;

/**
 * Base HTML template for the iframe
 * Modified to preserve original document structure and styles
 */
export const getBaseHtmlTemplate = (htmlContent: string): string => `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body { 
          margin: 0; 
          padding: 0;
          width: 100%;
          height: auto;
        }
        
        /* Highlighted elements basic styling */
        .highlighted {
          background-color: yellow !important;
        }
        .highlighted * {
          background-color: transparent !important;
        }
      </style>
      <script>
        // Add resize handler to recalculate document height
        window.addEventListener('resize', function() {
          // Force reflow calculation
          document.body.style.height = 'auto';
          // Small delay to ensure content has reflowed
          setTimeout(function() {
            // Inform parent of new height if needed
            if (window.parent && window.parent !== window) {
              const height = document.body.scrollHeight;
              window.parent.postMessage({ type: 'resize', height: height }, '*');
            }
          }, 100);
        });
        
        // Monitor mutations to handle dynamically loaded content
        window.addEventListener('load', function() {
          if (window.MutationObserver) {
            var observer = new MutationObserver(function(mutations) {
              // If content changes, update parent about new size
              if (window.parent && window.parent !== window) {
                const height = document.body.scrollHeight;
                window.parent.postMessage({ type: 'resize', height: height }, '*');
              }
            });
            
            // Observe changes to the body and its descendants
            observer.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: true,
              characterData: true
            });
          }
        });
      </script>
      <base target="_blank">
    </head>
    <body>${htmlContent}</body>
  </html>
`; 