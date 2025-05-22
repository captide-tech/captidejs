/**
 * Generate general document styles that apply to all document types
 */
export const generateGeneralStyles = (zoomLevel: number): string => `
  /* Base container styles */
  html, body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    max-width: 100%;
    overflow-x: hidden;
    margin: 0;
    padding: 0;
    background-color: white;
  }
  
  /* Apply consistent width to direct children of body */
  body > * {
    width: 100% !important;
    max-width: 100%;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 24px !important;
    padding-right: 24px !important;
    box-sizing: border-box !important;
  }
  
  /* Allow natural wrapping while preventing horizontal overflow */
  body * {
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1.025em; /* Slightly increase text size */
  }
  
  /* Handle tables more naturally */
  table {
    max-width: 100%;
    table-layout: auto;
    width: auto;
    margin-left: auto !important;
    margin-right: auto !important;
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
  
  /* Highlighted elements */
  .highlighted {
    background-color: yellow !important;
  }
  .highlighted * {
    background-color: transparent !important;
  }
  
  /* Make links visible */
  a {
    color: #2563eb;
    text-decoration: underline;
  }
`;

/**
 * Styles for 8-K and proxy statement documents
 */
export const generatePageBasedDocumentStyles = (zoomLevel: number): string => `
  /* Base container styles with consistent padding */
  html, body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    overflow-x: hidden;
    margin: 0;
    padding: 0;
    background-color: white;
  }
  
  /* Apply consistent width and padding to pages */
  .page-container, .captide-page {
    width: 100% !important;
    max-width: 100%;
    margin-left: auto !important;
    margin-right: auto !important;
    margin-bottom: 10px;
    padding: 16px !important;
    box-sizing: border-box !important;
    background-color: white;
    border: 1px solid #ddd;
  }
  
  .page-highlighted {
    outline: 4px solid yellow;
    outline-offset: -4px;
  }
  
  /* Styles for proxy statement documents with captide-page markers */
  .captide-page-highlighted {
    outline: 4px solid yellow;
    outline-offset: -4px;
  }
  
  /* Improve table rendering */
  table {
    max-width: 100%;
    table-layout: auto;
    margin-left: auto !important;
    margin-right: auto !important;
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
 * Styles for international filings (20-F, 40-F, 6-K, S-1)
 */
export const generateInternationalFilingStyles = (zoomLevel: number): string => `
  /* Base container styles */
  html, body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    margin: 0 !important;
    padding: 0 !important;
    background-color: white;
  }
  
  /* Center content with consistent width */
  body > div {
    width: 100% !important;
    max-width: 100%;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 16px !important;
    padding-right: 16px !important;
    box-sizing: border-box !important;
    position: relative !important;
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
    width: 100% !important;
    max-width: 100%;
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
  
  /* Preserve original styles while maintaining max-width */
  [style] {
    max-width: 100% !important;
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
 * Specific styles for 10-K and 10-Q financial filings
 */
export const generateFinancialFilingStyles = (zoomLevel: number): string => `
  /* Base container styles */
  html, body {
    transform-origin: top left;
    transform: scale(${zoomLevel});
    width: ${100 / zoomLevel}%;
    overflow-x: hidden;
    margin: 0;
    padding: 0;
    background-color: white;
  }
  
  /* Apply consistent width to direct children of body */
  body > * {
    width: 100% !important;
    max-width: 100%;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 16px !important;
    padding-right: 16px !important;
    box-sizing: border-box !important;
  }
  
  /* Ensure tables are displayed properly */
  table {
    max-width: 100%;
    table-layout: auto;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  
  /* Financial tables should be handled specially */
  .financial-table, 
  .ix_hidden, 
  .previewer-table,
  table[class*="table"],
  div[class*="table"] {
    width: auto !important;
    max-width: 100%;
    overflow-x: auto;
  }
  
  /* For numeric data columns, preserve formatting */
  td[align="right"], th[align="right"] {
    white-space: nowrap;
    text-align: right;
  }
  
  /* Highlighted elements */
  .highlighted {
    background-color: yellow !important;
  }
  
  .highlighted * {
    background-color: transparent !important;
  }
  
  /* Remove any unwanted margins/padding */
  body p, body div, body section, body article {
    max-width: 100%;
  }
`;

/**
 * Base HTML template for the iframe
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
          background-color: white;
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
          // Inform parent of new height if needed
          if (window.parent && window.parent !== window) {
            const height = document.body.scrollHeight;
            window.parent.postMessage({ type: 'resize', height: height }, '*');
          }
        });
        
        // Initialize height after content is loaded
        document.addEventListener('DOMContentLoaded', function() {
          if (window.parent && window.parent !== window) {
            setTimeout(function() {
              const height = document.body.scrollHeight;
              window.parent.postMessage({ type: 'resize', height: height }, '*');
            }, 200);
          }
        });
      </script>
      <base target="_blank">
    </head>
    <body>${htmlContent}</body>
  </html>
`; 