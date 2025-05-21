import { SourceType, FileType } from '../../../types';

/**
 * Process HTML content for 8-K documents to identify page breaks and create page containers
 * @param html Raw HTML content
 * @returns Processed HTML with page containers
 */
export const processHtmlForPageBreaks = (html: string): string => {
  // Improved slide deck detection with more robust checks
  const isSlideDeck = (
    // Check for any exhibit99 pattern (case insensitive)
    /ex(hibit)?[-_]?99/i.test(html) &&
    // Has images
    (html.includes('.jpg') || html.includes('.png')) &&
    // Has slide structure indicators (particularly in Tesla and similar reports)
    html.includes('padding-top:2em;')
  );
  
  if (isSlideDeck) {
    return processSlideDeckFormat(html);
  }
  
  // Primary pattern: HR tags with page-break styles (most common in SEC documents)
  const primaryPatterns = [
    /<hr[^>]*style=['"]page-break-after:always['"][^>]*>/gi,
    /<hr[^>]*style=['"][^"']*page-break[^"']*['"][^>]*>/gi
  ];
  
  // Fallback patterns to use if primary patterns don't match enough
  const fallbackPatterns = [
    /<div[^>]*class=['"]BRPFPageBreak['"][^>]*>/gi,
    /<div[^>]*style=['"][^"']*page-break-before:always['"][^>]*>/gi,
    /<div[^>]*style=['"][^"']*page-break-after:always['"][^>]*>/gi,
    /<div[^>]*style=['"]min-height:42\.75pt;[^"']*['"][^>]*><div><[^>]*><br><\/[^>]*><\/div><\/div>/gi,
    /<hr[^>]*noshade[^>]*>/gi
  ];
  
  // Generic HR pattern as final fallback
  const genericHrPattern = /<hr[^>]*>/gi;
  
  // Count primary pattern matches
  let primaryMatches = 0;
  primaryPatterns.forEach((pattern) => {
    const matches = html.match(pattern) || [];
    primaryMatches += matches.length;
  });
  
  // Replace all primary pattern matches with a standardized marker
  let processedHtml = html;
  primaryPatterns.forEach(pattern => {
    processedHtml = processedHtml.replace(pattern, '<!-- PAGE_BREAK -->');
  });
  
  // If we don't have enough primary matches, try fallback patterns
  if (primaryMatches < 2) {
    fallbackPatterns.forEach((pattern) => {
      const matches = processedHtml.match(pattern) || [];
      if (matches.length > 0) {
        processedHtml = processedHtml.replace(pattern, '<!-- PAGE_BREAK -->');
      }
    });
  }
  
  // If we still don't have enough page breaks, use generic HR as the final fallback
  if (!processedHtml.includes('<!-- PAGE_BREAK -->')) {
    processedHtml = processedHtml.replace(genericHrPattern, '<!-- PAGE_BREAK -->');
  }
  
  // Split the HTML by our markers
  const pageContentArray = processedHtml.split('<!-- PAGE_BREAK -->');
  
  // Filter out empty segments to avoid blank pages
  const nonEmptyPages = pageContentArray.filter(content => content.trim().length > 0);
  
  // Prepare the final HTML with page containers
  let finalHtml = '<html><head><style>';
  finalHtml += `
    .page-container {
      margin-bottom: 20px;
      padding: 10px;
      border: 1px solid #ddd;
      background-color: white;
      position: relative;
    }
    .page-highlighted {
      outline: 4px solid yellow;
      outline-offset: -4px;
    }
    .page-number {
      position: absolute;
      top: 5px;
      right: 5px;
      background-color: rgba(0,0,0,0.1);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      z-index: 1000;
    }
  `;
  finalHtml += '</style></head><body><div id="document-pages-wrapper">';
  
  // Create page containers for each content segment, ensuring sequential page numbers
  nonEmptyPages.forEach((content, index) => {
    finalHtml += `<div class="page-container" data-page="${index}">`;
    finalHtml += `<div class="page-number">${index + 1}</div>`;
    finalHtml += content;
    finalHtml += '</div>';
  });
  
  finalHtml += '</div></body></html>';
  
  return finalHtml;
};

/**
 * Special processor for slide deck format 8-K documents
 * These have a specific structure with image slides followed by page breaks
 */
export const processSlideDeckFormat = (html: string): string => {
  // Create a temporary DOM element to parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find all slide elements containing images (the actual slides, not page breaks)
  // Focus on the div with padding-top that typically contains the slide image
  const slideElements = Array.from(doc.querySelectorAll('div[style*="padding-top:2em"]'));
  
  if (slideElements.length === 0) {
    return html;
  }
  
  // Start fresh with new HTML structure
  let finalHtml = '<html><head><style>';
  finalHtml += `
    .page-container {
      margin-bottom: 20px;
      padding: 10px;
      border: 1px solid #ddd;
      background-color: white;
      position: relative;
    }
    .page-highlighted {
      outline: 4px solid yellow;
      outline-offset: -4px;
    }
    .page-number {
      position: absolute;
      top: 5px;
      right: 5px;
      background-color: rgba(0,0,0,0.1);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      z-index: 1000;
    }
  `;
  finalHtml += '</style></head><body><div id="document-pages-wrapper">';
  
  // Create a separate page container for each slide element (not page breaks)
  slideElements.forEach((slide, index) => {
    // Each slide gets its own page container - this is the actual content we want to display
    finalHtml += `<div class="page-container" data-page="${index}">`;
    finalHtml += `<div class="page-number">${index + 1}</div>`;
    
    // Include the entire slide div with its contents (image and text)
    finalHtml += slide.outerHTML;
    
    // Close the page container
    finalHtml += '</div>';
  });
  
  finalHtml += '</div></body></html>';
  
  return finalHtml;
};

/**
 * Helper function to check if document is an international filing type
 */
export const isInternationalFiling = (sourceType: string): boolean => {
  const normalizedType = sourceType.toUpperCase();
  return normalizedType === '20-F' || normalizedType === '40-F' || normalizedType === '6-K' || normalizedType === 'S-1';
};

/**
 * Helper function to check if document is a proxy statement
 */
export const isProxyStatement = (sourceType: string): boolean => {
  const normalizedType = sourceType.toUpperCase();
  return normalizedType === 'DEF 14A' || 
         normalizedType === 'DEFM14A' || 
         normalizedType === 'DEF 14C' || 
         normalizedType === 'DEFM14C';
};

/**
 * Helper function to check if document is an IR document
 */
export const isIRDocument = (sourceType: string): boolean => {
  return sourceType.toLowerCase() === 'ir';
};

/**
 * Helper function to check if document is a binary document (PDF or Excel)
 */
export const isBinaryDocument = (sourceType: string, fileType?: FileType): boolean => {
  return sourceType.toLowerCase() === 'ir' && !!fileType && (fileType === 'pdf' || fileType === 'xlsx');
}; 