import React, { useEffect, useRef } from 'react';
import { useDocumentViewer } from '../contexts/DocumentViewerContext';
import { SourceType } from '../types';

interface DocumentViewerProps {
  /**
   * Optional custom CSS class name
   */
  className?: string;
  
  /**
   * Optional inline styles
   */
  style?: React.CSSProperties;
  
  /**
   * Whether to show zoom controls
   * @default true
   */
  showZoomControls?: boolean;
}

/**
 * DocumentViewer Component
 * 
 * Renders an iframe containing document content (SEC filings, 8-K documents, or earnings call transcripts)
 * and handles highlighting of specific elements.
 * 
 * Features:
 * - Support for all document types (10-K/10-Q filings, 8-K documents, and earnings call transcripts)
 * - Smart element highlighting with clustering
 * - Efficient document reloading on content change
 * - Zoom controls for adjusting document scale
 */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  className = 'w-full h-full',
  style,
  showZoomControls = true
}) => {
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

  /**
   * Process HTML content for 8-K documents to identify page breaks and create page containers
   * @param html Raw HTML content
   * @returns Processed HTML with page containers
   */
  const processHtmlForPageBreaks = (html: string): string => {
    console.log('Processing HTML for page breaks');
    
    // Improved slide deck detection with more robust checks
    const isSlideDeck = (
      // Check for any exhibit99 pattern (case insensitive)
      /ex(hibit)?[-_]?99/i.test(html) &&
      // Has images
      (html.includes('.jpg') || html.includes('.png')) &&
      // Has slide structure indicators (particularly in Tesla and similar reports)
      html.includes('padding-top:2em;')
    );
    
    console.log('❣️isSlideDeck', isSlideDeck);
    
    if (isSlideDeck) {
      console.log('Detected slide deck format - using specialized processing');
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
    primaryPatterns.forEach((pattern, index) => {
      const matches = html.match(pattern) || [];
      primaryMatches += matches.length;
      if (matches.length > 0) {
        console.log(`Found ${matches.length} matches for primary pattern ${index + 1}`);
      }
    });
    
    // Replace all primary pattern matches with a standardized marker
    let processedHtml = html;
    primaryPatterns.forEach(pattern => {
      processedHtml = processedHtml.replace(pattern, '<!-- PAGE_BREAK -->');
    });
    
    // If we don't have enough primary matches, try fallback patterns
    if (primaryMatches < 2) {
      console.log("Not enough primary page breaks found, trying fallback patterns");
      
      fallbackPatterns.forEach((pattern, index) => {
        const matches = processedHtml.match(pattern) || [];
        if (matches.length > 0) {
          console.log(`Found ${matches.length} matches for fallback pattern ${index + 1}`);
          processedHtml = processedHtml.replace(pattern, '<!-- PAGE_BREAK -->');
        }
      });
    }
    
    // If we still don't have enough page breaks, use generic HR as the final fallback
    if (!processedHtml.includes('<!-- PAGE_BREAK -->')) {
      const genericHrMatches = html.match(genericHrPattern) || [];
      console.log(`Using ${genericHrMatches.length} generic HR elements as page breaks`);
      processedHtml = processedHtml.replace(genericHrPattern, '<!-- PAGE_BREAK -->');
    }
    
    // Split the HTML by our markers
    const pageContentArray = processedHtml.split('<!-- PAGE_BREAK -->');
    console.log(`HTML split into ${pageContentArray.length} segments`);
    
    // Filter out empty segments to avoid blank pages
    const nonEmptyPages = pageContentArray.filter(content => content.trim().length > 0);
    console.log(`After filtering empty segments: ${nonEmptyPages.length} pages`);
    
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
    console.log(`Created ${nonEmptyPages.length} pages using split approach`);
    
    return finalHtml;
  };

  /**
   * Special processor for slide deck format 8-K documents
   * These have a specific structure with image slides followed by page breaks
   */
  const processSlideDeckFormat = (html: string): string => {
    console.log('Processing slide deck format');
    
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all slide elements containing images (the actual slides, not page breaks)
    // Focus on the div with padding-top that typically contains the slide image
    const slideElements = Array.from(doc.querySelectorAll('div[style*="padding-top:2em"]'));
    console.log(`Found ${slideElements.length} potential slide elements`);
    
    if (slideElements.length === 0) {
      console.log('No slide elements found, falling back to standard processing');
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
    console.log(`Created ${slideElements.length} separate slide pages`);
    
    return finalHtml;
  };

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
        
        // Calculate new scroll position to keep the same point centered
        const newCenterX = centerX * scaleFactor;
        const newCenterY = centerY * scaleFactor;
        
        // Calculate new scroll position (accounting for current viewport size)
        const newScrollX = newCenterX - (viewportWidth / 2);
        const newScrollY = newCenterY - (viewportHeight / 2);
        
        // Add a transition for smooth zooming
        if (previousZoomLevelRef.current) {
          iframeDocument.body.style.transition = 'transform 0.2s ease';
          
          // Immediately scroll to new position to prevent jarring shift
          if (iframeWindow) {
            iframeWindow.scrollTo({
              left: newScrollX,
              top: newScrollY,
              behavior: 'auto' // Use instant scroll to prevent double animation
            });
          }
          
          // Remove the transition after it completes
          setTimeout(() => {
            if (iframeDocument.body) {
              iframeDocument.body.style.transition = '';
            }
          }, 210);
        } else {
          // If it's the first time applying zoom, just scroll without transition
          if (iframeWindow) {
            iframeWindow.scrollTo({
              left: newScrollX,
              top: newScrollY,
              behavior: 'auto'
            });
          }
        }
      }
      
      previousZoomLevelRef.current = zoomLevel;
    }
  }, [zoomLevel]); // Only depend on zoomLevel, not document or highlightedElementId

  // Handle document loading and highlighting
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !document) return;

    // Get the sourceType from the document
    const sourceType = document.sourceType;

    /**
     * Finds the most relevant scroll target among multiple highlighted elements.
     * @param elements - NodeList of highlighted elements
     * @returns The element to scroll to
     */
    const findBestScrollTarget = (elements: NodeListOf<Element>): Element | null => {
      if (elements.length === 0) return null;
      if (elements.length === 1) return elements[0];

      // Convert NodeList to array for easier manipulation
      const elementsArray = Array.from(elements);

      // For transcript documents, prioritize certain element types
      if (sourceType === 'transcript') {
        // First, check if any highlighted element is within a paragraph with a speaker-name
        const speakerElements = elementsArray.filter(el => {
          // Check if this element or any parent has a speaker-name
          return (
            el.closest('p')?.querySelector('.speaker-name') || 
            el.parentElement?.closest('p')?.querySelector('.speaker-name')
          );
        });

        if (speakerElements.length > 0) {
          // Return the first element with a speaker name - more likely to be the primary content
          return speakerElements[0];
        }

        // Use smaller clustering distance for transcripts
        const clusterDistance = 200; // px
      
        // Calculate clusters of elements based on their vertical position
        const clusters: Element[][] = [];
        let currentCluster: Element[] = [elementsArray[0]];
        
        for (let i = 1; i < elementsArray.length; i++) {
          const currentElement = elementsArray[i];
          const previousElement = elementsArray[i - 1];
          const verticalDistance = Math.abs(
            currentElement.getBoundingClientRect().top - 
            previousElement.getBoundingClientRect().top
          );

          // Use smaller distance for transcript clustering
          if (verticalDistance < clusterDistance) {
            currentCluster.push(currentElement);
          } else {
            clusters.push(currentCluster);
            currentCluster = [currentElement];
          }
        }
        clusters.push(currentCluster);

        // Find the largest cluster
        const largestCluster = clusters.reduce((largest, current) => 
          current.length > largest.length ? current : largest
        , clusters[0]);

        // Return the first element of the largest cluster for transcripts
        // This is often more accurate than the middle for transcript data
        return largestCluster[0];
      }
      else {
        // Original clustering logic for filings
        // Calculate clusters of elements based on their vertical position
        const clusters: Element[][] = [];
        let currentCluster: Element[] = [elementsArray[0]];
        
        for (let i = 1; i < elementsArray.length; i++) {
          const currentElement = elementsArray[i];
          const previousElement = elementsArray[i - 1];
          const verticalDistance = Math.abs(
            currentElement.getBoundingClientRect().top - 
            previousElement.getBoundingClientRect().top
          );

          // If elements are close together (within 500px), add to current cluster
          if (verticalDistance < 500) {
            currentCluster.push(currentElement);
          } else {
            // Start a new cluster
            clusters.push(currentCluster);
            currentCluster = [currentElement];
          }
        }
        clusters.push(currentCluster);

        // Find the largest cluster
        const largestCluster = clusters.reduce((largest, current) => 
          current.length > largest.length ? current : largest
        , clusters[0]);

        // Return the middle element of the largest cluster for filings
        return largestCluster[Math.floor(largestCluster.length / 2)];
      }
    };

    // Handle Load specifically for 8-K and DEF 14A documents
    const handlePageBasedDocumentLoad = () => {
      const iframeDocument = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      if (!iframeDocument || !iframeWindow) return;

      // For 8-K and DEF 14A documents, we need to highlight the correct page
      if ((document.sourceType === '8-K' || document.sourceType === 'DEF 14A') && highlightedElementId) {
        // Extract page number from the last four digits of the highlightedElementId
        // Format: #f2340000 where 0000 is page 1, 0001 is page 2, etc.
        const cleanId = highlightedElementId.replace('#', '');
        const pageNumberStr = cleanId.slice(-4);
        // Convert the string to a number and make it zero-based (0000 -> page 0)
        const pageNumber = parseInt(pageNumberStr, 10);
        
        console.log(`Highlighting page ${pageNumber} for ${document.sourceType} document (extracted from ID ${highlightedElementId})`);

        // For DEF 14A documents, use the injected highlightCaptidePage function
        if (document.sourceType === 'DEF 14A') {
          // The page numbers in captide-page are 1-based, while our internal pageNumber is 0-based
          const oneBasedPageNumber = pageNumber + 1;
          console.log(`Using highlightCaptidePage function for DEF 14A document with page ${oneBasedPageNumber}`);
          
          // Use a small timeout to ensure DOM is fully loaded
          setTimeout(() => {
            // Check if the highlightCaptidePage function exists
            if (typeof iframeWindow.highlightCaptidePage === 'function') {
              const success = iframeWindow.highlightCaptidePage(oneBasedPageNumber);
              console.log(`Highlighted DEF 14A page ${oneBasedPageNumber} with result: ${success}`);
            } else {
              console.error('highlightCaptidePage function not found in iframe window');
              
              // Fallback: try to find elements with data-page-number attribute
              const pageElements = iframeDocument.querySelectorAll(`.captide-page[data-page-number="${oneBasedPageNumber}"]`);
              if (pageElements.length > 0) {
                // Remove existing highlights
                const existingHighlights = iframeDocument.querySelectorAll('.captide-page-highlighted');
                existingHighlights.forEach(el => {
                  el.classList.remove('captide-page-highlighted');
                });
                
                // Highlight the first page element and scroll to it
                pageElements[0].classList.add('captide-page-highlighted');
                pageElements[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log(`Fallback: highlighted DEF 14A page ${oneBasedPageNumber} manually`);
              } else {
                console.error(`No page elements found for DEF 14A page ${oneBasedPageNumber}`);
              }
            }
          }, 200);
          
          return; // Exit early for DEF 14A documents
        }
        
        // For 8-K documents, continue with existing page container approach
        // Find all page containers
        const pageContainers = iframeDocument.querySelectorAll('.page-container');
        console.log(`Found ${pageContainers.length} page containers in the document`);
        
        if (pageContainers && pageContainers.length > 0) {
          // Log all page numbers to help with debugging
          Array.from(pageContainers).forEach((container, idx) => {
            console.log(`Page ${idx} data-page attribute: ${container.getAttribute('data-page')}`);
          });
          
          // Remove existing highlights
          const existingHighlights = iframeDocument.querySelectorAll('.page-highlighted');
          existingHighlights.forEach(el => {
            el.classList.remove('page-highlighted');
          });

          // Find the page to highlight
          let targetPage: Element | null = null;
          
          // Ensure we don't go out of bounds
          const targetPageIndex = Math.min(pageNumber, pageContainers.length - 1);
          targetPage = pageContainers[targetPageIndex];
          
          console.log(`Target page index: ${targetPageIndex}`);
          
          if (targetPage) {
            // Highlight the page
            targetPage.classList.add('page-highlighted');
            console.log(`Highlighted page ${targetPageIndex}`);
            
            // Scroll to the target page
            setTimeout(() => {
              if (targetPage) {
                targetPage.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'start'
                });
                console.log(`Scrolled to page ${targetPageIndex}`);
              }
            }, 100);
          } else {
            console.error(`Target page at index ${targetPageIndex} not found`);
          }
        }
      }
    };

    const handleLoad = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) return;

      // Add styles for document types
      if (document.sourceType === '8-K' || document.sourceType === 'DEF 14A') {
        const style = iframeDocument.createElement('style');
        style.textContent = `
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
          
          /* Styles for DEF 14A documents with captide-page markers */
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
        iframeDocument.head.appendChild(style);
        
        // Call page-based document specific handler
        handlePageBasedDocumentLoad();
        return;
      }

      // Remove existing highlights
      const existingHighlights = iframeDocument.querySelectorAll('.highlighted');
      existingHighlights.forEach(el => {
        el.classList.remove('highlighted');
      });

      if (highlightedElementId) {
        const cleanId = highlightedElementId.replace('#', '');
        
        // Get document identifier for determining if this is a new document
        const currentDocId = document.sourceLink;
        
        const isNewDocument = previousDocumentRef.current !== currentDocId || 
                             previousSourceTypeRef.current !== document.sourceType;
        const delay = isNewDocument ? 500 : 0;

        setTimeout(() => {
          // Find all elements with matching ID
          const elementsToHighlight = iframeDocument.querySelectorAll(
            `[unique_id*="${cleanId}"], [unique-id*="${cleanId}"], [unique-id*="#${cleanId}"], [id*="[#${cleanId}]"]`
          );

          if (elementsToHighlight.length > 0) {
            // First highlight all directly matching elements
            elementsToHighlight.forEach(element => {
              element.classList.add('highlighted');
            });
            
            // Enhanced highlighting: find elements between matching unique-id spans
            // This ensures continuity in highlighting for 10-K and 10-Q documents
            if (document.sourceType === '10-K' || document.sourceType === '10-Q') {
              const elementsArray = Array.from(elementsToHighlight);
              
              // Group highlighted elements by their common parent
              const parentMap = new Map();
              
              elementsArray.forEach(element => {
                // Get the closest paragraph or div as the container
                const container = element.closest('p') || element.closest('div');
                if (container) {
                  if (!parentMap.has(container)) {
                    parentMap.set(container, []);
                  }
                  parentMap.get(container).push(element);
                }
              });
              
              // Process each container with highlighted elements
              parentMap.forEach((highlightedElements, container) => {
                if (highlightedElements.length > 1) {
                  // Sort elements by their position in the DOM
                  highlightedElements.sort((a: Element, b: Element) => {
                    const position = a.compareDocumentPosition(b);
                    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
                  });
                  
                  // Find the first and last highlighted elements
                  const firstElement = highlightedElements[0];
                  const lastElement = highlightedElements[highlightedElements.length - 1];
                  
                  // Get all text nodes and elements within the container
                  const walker = iframeDocument.createTreeWalker(
                    container,
                    NodeFilter.SHOW_ELEMENT,
                    null
                  );
                  
                  // Variables to track when we're in the "between highlighted elements" range
                  let foundFirstElement = false;
                  let foundLastElement = false;
                  let currentNode = walker.nextNode();
                  
                  // Walk through all elements in the container
                  while (currentNode) {
                    // If we found the first highlighted element, start highlighting
                    if (currentNode === firstElement || currentNode.contains(firstElement)) {
                      foundFirstElement = true;
                    }
                    
                    // If we're between first and last elements, highlight this node
                    if (foundFirstElement && !foundLastElement) {
                      if (currentNode.nodeType === Node.ELEMENT_NODE) {
                        (currentNode as Element).classList.add('highlighted');
                      }
                    }
                    
                    // If we found the last highlighted element, stop highlighting
                    if (currentNode === lastElement || currentNode.contains(lastElement)) {
                      foundLastElement = true;
                    }
                    
                    currentNode = walker.nextNode();
                  }
                  
                  // Special handling for nested elements with ix:nonfraction tags
                  // This ensures that numeric values inside ix:nonfraction are also highlighted
                  const allNestedElements = container.querySelectorAll('*');
                  allNestedElements.forEach((nestedElement: Element) => {
                    // Check if this element is between the first and last highlighted elements in DOM order
                    const isAfterFirst = 
                      firstElement.compareDocumentPosition(nestedElement) & 
                      Node.DOCUMENT_POSITION_FOLLOWING;
                    const isBeforeLast = 
                      lastElement.compareDocumentPosition(nestedElement) & 
                      Node.DOCUMENT_POSITION_PRECEDING;
                      
                    // Also highlight elements that are inside one of our highlighted elements
                    const isInsideHighlighted = Array.from(highlightedElements as Element[]).some(el => 
                      el.contains(nestedElement)
                    );
                    
                    if ((isAfterFirst && isBeforeLast) || isInsideHighlighted) {
                      nestedElement.classList.add('highlighted');
                    }
                  });
                }
              });
            }
            
            // Find the best element to scroll to
            const scrollTarget = findBestScrollTarget(elementsToHighlight);
            
            if (scrollTarget) {
              if (document.sourceType === 'transcript') {
                // For transcripts, we need to be more precise about scrolling
                
                // Get the exact position of the highlighted element
                const targetRect = scrollTarget.getBoundingClientRect();
                const iframeRect = iframe.getBoundingClientRect();
                
                // Get the iframe's content window and document
                const contentWindow = iframe.contentWindow;
                const contentDocument = iframe.contentDocument;
                
                if (contentWindow && contentDocument) {
                  // Calculate desired position - we want the element about 100px from the top
                  // This gives context above the highlighted element
                  
                  // Get current scroll position and viewport height
                  const currentScrollY = contentWindow.scrollY;
                  const viewportHeight = contentWindow.innerHeight;
                  
                  // Get target's position relative to the document
                  const docElement = contentDocument.documentElement;
                  const targetOffsetTop = targetRect.top + currentScrollY;
                  
                  // Calculate the ideal scroll position (element 100px from top)
                  const idealScrollPosition = targetOffsetTop - 100;
                  
                  // Check if the highlight is inside a very long paragraph
                  const containingParagraph = scrollTarget.closest('p');
                  if (containingParagraph) {
                    const paragraphHeight = containingParagraph.getBoundingClientRect().height;
                    
                    // If this is a very tall paragraph (indicating long text from one speaker)
                    if (paragraphHeight > viewportHeight * 0.7) {
                      // Position based on the highlighted span, not the paragraph
                      contentWindow.scrollTo({
                        top: idealScrollPosition,
                        behavior: isNewDocument ? 'auto' : 'smooth'
                      });
                      return;
                    }
                  }
                  
                  // For normal cases, determine the best container to scroll to
                  // Often the paragraph containing the speaker name is most appropriate
                  const closestParagraph = scrollTarget.closest('p');
                  const closestPart = scrollTarget.closest('.qa-part') || scrollTarget.closest('.remark-part');
                  
                  let containerToScroll: Element | null = null;
                  
                  if (closestParagraph) {
                    containerToScroll = closestParagraph;
                  } else if (closestPart) {
                    containerToScroll = closestPart;
                  } else {
                    containerToScroll = scrollTarget;
                  }
                  
                  if (containerToScroll) {
                    const containerRect = containerToScroll.getBoundingClientRect();
                    const containerTop = containerRect.top + currentScrollY;
                    
                    // Scroll to position the container appropriately
                    contentWindow.scrollTo({
                      top: containerTop - 80, // Position with some space above
                      behavior: isNewDocument ? 'auto' : 'smooth'
                    });
                  } else {
                    // Fallback to direct scrolling if no container found
                    contentWindow.scrollTo({
                      top: idealScrollPosition,
                      behavior: isNewDocument ? 'auto' : 'smooth'
                    });
                  }
                }
              } else if (document.sourceType === '10-K' || document.sourceType === '10-Q') {
                // Enhanced handling for 10-K and 10-Q documents with reliable scrolling
                // Get the iframe's content window for scrolling operations
                const contentWindow = iframe.contentWindow;
                const contentDocument = iframe.contentDocument;
                
                if (!contentWindow || !contentDocument) {
                  console.error('Cannot access iframe content window or document');
                  return;
                }
                
                // Define a function to scroll to the element with retry capability
                const scrollToHighlightedElement = (attempt = 1, maxAttempts = 3) => {
                  // Get fresh positions as they might have changed
                  const freshRect = scrollTarget.getBoundingClientRect();
                  
                  // Check if element is properly positioned (has height/width)
                  const hasValidDimensions = freshRect.height > 0 && freshRect.width > 0;
                  
                  if (hasValidDimensions) {
                    // Calculate the absolute position of the element relative to the document
                    // Add a margin at top for better visibility
                    const absoluteTop = freshRect.top + contentWindow.scrollY - 100;
                    
                    // Use direct window scrolling (most reliable in iframes)
                    contentWindow.scrollTo({
                      top: absoluteTop,
                      behavior: isNewDocument ? 'auto' : 'smooth'
                    });
                    
                    return true;
                  } else if (attempt < maxAttempts) {
                    // Element not properly rendered yet, retry with exponential backoff
                    const nextDelay = attempt * 300; // 300ms, 600ms, 900ms
                    
                    setTimeout(() => {
                      scrollToHighlightedElement(attempt + 1, maxAttempts);
                    }, nextDelay);
                    
                    return false;
                  } else {
                    // If all attempts fail, try the fallback approach with scrollIntoView
                    const finalScrollTarget = scrollTarget.closest('div') || 
                                          scrollTarget.parentElement || 
                                          scrollTarget;
                    
                    finalScrollTarget.scrollIntoView({ 
                      behavior: 'auto',
                      block: 'center'
                    });
                    
                    return false;
                  }
                };
                
                // Start the first attempt with appropriate initial delay
                const initialDelay = isNewDocument ? 800 : 200;
                setTimeout(() => {
                  scrollToHighlightedElement();
                }, initialDelay);
              } else {
                // For other filings, use the original approach with improvements
                const finalScrollTarget = scrollTarget.closest('div') || 
                                      scrollTarget.parentElement || 
                                      scrollTarget;
                                      
                finalScrollTarget.scrollIntoView({ 
                  behavior: isNewDocument ? 'auto' : 'smooth',
                  block: 'center'
                });
              }
            }
          }
        }, delay);
      }

      // Add general styles for all document types
      const generalStyle = iframeDocument.createElement('style');
      generalStyle.textContent = `
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
      iframeDocument.head.appendChild(generalStyle);
    };

    // Get HTML content based on document type
    let htmlContent: string;
    let documentIdentifier: string | null = null;
    
    htmlContent = document.htmlContent || '';
    documentIdentifier = document.sourceLink;
    
    // Special handling for 8-K documents to process page breaks
    // For DEF 14A documents, keep the original HTML as it already has our custom page markers
    if (document.sourceType === '8-K') {
      htmlContent = processHtmlForPageBreaks(htmlContent);
    }

    const formattedHtmlContent = `
      <html>
        <head>
          <style>
            body { 
              margin: 0; 
              padding: 16px; 
              overflow-x: auto;
            }
            .highlighted {
              background-color: yellow !important;
            }
            .highlighted * {
              background-color: transparent !important;
            }
          </style>
          <base target="_blank">
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

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
  }, [document, highlightedElementId]); // Remove zoomLevel from dependencies

  if (isLoading) {
    return <div className={className} style={style}>Loading document...</div>;
  }

  if (!document) {
    return <div className={className} style={style}>No document selected</div>;
  }

  return (
    <div className="relative flex flex-col h-full group">
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
      
      <iframe
        ref={iframeRef}
        className={className}
        style={{
          ...style,
          width: '100%',
          height: '100%',
          overflow: 'auto',
        }}
        sandbox="allow-same-origin allow-popups"
      />
    </div>
  );
};

export default DocumentViewer; 