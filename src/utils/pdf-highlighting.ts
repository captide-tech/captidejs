/**
 * PDF Highlighting Utility
 * 
 * Provides functionality to find and highlight text in PDF documents using PDF.js
 */

export interface HighlightResult {
  page: number;
  textItems: Array<{
    index: number;
    item: any;
    start: number;
    end: number;
  }>;
  textContent: any;
}

export interface CurrentHighlight {
  element: HTMLElement;
  page: number;
  text: string;
}

/**
 * Normalize text for comparison (remove spaces, dollar signs, make lowercase)
 */
const normalizeText = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/\$/g, '') // Remove dollar signs
    .trim();
};

/**
 * Extract text content from a PDF page
 */
const extractTextFromPage = async (pageView: any) => {
  try {
    if (!pageView?.pdfPage) return null;
    const textContent = await pageView.pdfPage.getTextContent();
    const textItems = textContent.items.map((item: any) => item.str);
    const fullText = textItems.join(' ');
    return { textItems, fullText, textContent };
  } catch (error) {
    return null;
  }
};

/**
 * Find text in PDF and return matching text items with coordinates
 */
export const findTextInPDF = async (
  searchText: string, 
  pdfViewerInstance: any, 
  targetPage?: number
): Promise<HighlightResult | null> => {
  if (!searchText || !pdfViewerInstance) return null;

  const pagesToSearch = targetPage 
    ? [targetPage] 
    : Array.from({ length: pdfViewerInstance.pagesCount }, (_, i) => i + 1);
  
  for (const pageNum of pagesToSearch) {
    const pageView = pdfViewerInstance.getPageView(pageNum - 1);
    const pageTextData = await extractTextFromPage(pageView);
    if (!pageTextData) continue;
    
    // Normalize both texts for comparison
    const normalizedPageText = normalizeText(pageTextData.fullText);
    const normalizedSearch = normalizeText(searchText);
    
    const matchIndex = normalizedPageText.indexOf(normalizedSearch);
    
    if (matchIndex !== -1) {
      // Map normalized index back to original text to find matching text items
      const matchingTextItems = [];
      let normalizedPos = 0;

      for (let i = 0; i < pageTextData.textContent.items.length; i++) {
        const textItem = pageTextData.textContent.items[i];
        const normalizedItemText = normalizeText(textItem.str);
        const itemStart = normalizedPos;
        const itemEnd = normalizedPos + normalizedItemText.length;
        
        // Check if this text item overlaps with our match
        if (itemStart < matchIndex + normalizedSearch.length && itemEnd > matchIndex) {
          matchingTextItems.push({
            index: i,
            item: textItem,
            start: Math.max(itemStart, matchIndex),
            end: Math.min(itemEnd, matchIndex + normalizedSearch.length)
          });
        }
        normalizedPos += normalizedItemText.length;
      }
      
      if (matchingTextItems.length > 0) {
        return {
          page: pageNum,
          textItems: matchingTextItems,
          textContent: pageTextData.textContent
        };
      }
    }
  }
  return null;
};

/**
 * Create a rectangle highlight overlay on a PDF page
 */
export const createRectangleHighlight = async (
  searchText: string,
  pdfViewerInstance: any,
  targetPage?: number,
  currentHighlight?: CurrentHighlight | null
): Promise<CurrentHighlight | null> => {
  if (!searchText || !pdfViewerInstance) return null;

  // Check if we already have a highlight for the same text and page
  if (currentHighlight && 
      currentHighlight.text === searchText && 
      currentHighlight.page === (targetPage || pdfViewerInstance.currentPageNumber)) {
    return currentHighlight;
  }
  
  const result = await findTextInPDF(searchText, pdfViewerInstance, targetPage);
  if (!result) return null;

  // Navigate to the page if needed
  if (result.page !== pdfViewerInstance.currentPageNumber) {
    pdfViewerInstance.currentPageNumber = Number(result.page);
  }

  return new Promise((resolve) => {
    (async () => {
      const currentPageView = pdfViewerInstance.getPageView(result.page - 1);
      if (!currentPageView?.div) {
        resolve(null);
        return;
      }
      
      const pageDiv = currentPageView.div;
      
      // Calculate bounding box from matching text items
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasValidCoordinates = false;
      
      for (const matchItem of result.textItems) {
        const item = matchItem.item;
        if (item.transform && item.width && item.height) {
          const x = item.transform[4]; // x coordinate
          const y = item.transform[5]; // y coordinate
          const width = item.width;
          const height = item.height;
          
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
          hasValidCoordinates = true;
        }
      }
      
      if (!hasValidCoordinates) {
        resolve(null);
        return;
      }
      
      // Convert PDF coordinates to viewport coordinates
      const viewport = currentPageView.viewport;
      const [x1, y1] = viewport.convertToViewportPoint(minX, minY);
      const [x2, y2] = viewport.convertToViewportPoint(maxX, maxY);
      
      // Create the highlight rectangle
      const highlightElement = document.createElement('div');
      highlightElement.className = 'pdf-rectangle-highlight';
      
      // Add some padding for better visibility and shift up/left
      const padding = 4;
      const offsetX = 9; // shift more to the left
      const offsetY = 2; // shift more up
      highlightElement.style.left = `${Math.min(x1, x2) - padding - offsetX}px`;
      highlightElement.style.top = `${Math.min(y1, y2) - padding - offsetY}px`;
      highlightElement.style.width = `${Math.abs(x2 - x1) + padding * 2}px`;
      highlightElement.style.height = `${Math.abs(y2 - y1) + padding * 2}px`;
      
      // Add to page
      pageDiv.style.position = 'relative';
      pageDiv.appendChild(highlightElement);
      
      const highlight: CurrentHighlight = {
        element: highlightElement,
        page: result.page,
        text: searchText
      };
      
      resolve(highlight);
    })();
  });
};

/**
 * Remove a highlight element from the DOM
 */
export const removeHighlight = (highlight: CurrentHighlight | null): void => {
  if (highlight?.element) {
    highlight.element.remove();
  }
}; 