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
 * - Support for international filings (20-F, 40-F, and 6-K documents) with comment-based highlighting
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
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Process HTML content for 8-K documents to identify page breaks and create page containers
   * @param html Raw HTML content
   * @returns Processed HTML with page containers
   */
  const processHtmlForPageBreaks = (html: string): string => {
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
      const genericHrMatches = html.match(genericHrPattern) || [];
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
  const processSlideDeckFormat = (html: string): string => {
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

  // Helper function to check if document is an international filing type
  const isInternationalFiling = (sourceType: string): boolean => {
    return sourceType === '20-F' || sourceType === '40-F' || sourceType === '6-K';
  };

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

    // Helper function to check if document is a proxy statement
    const isProxyStatement = (sourceType: string): boolean => {
      return sourceType === 'DEF 14A' || 
             sourceType === 'DEFM14A' || 
             sourceType === 'DEF 14C' || 
             sourceType === 'DEFM14C';
    };

    // Handle Load specifically for 8-K and DEF 14A documents
    const handlePageBasedDocumentLoad = () => {
      const iframeDocument = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      if (!iframeDocument || !iframeWindow) return;

      // For 8-K and DEF 14A documents, we need to highlight the correct page
      if ((document.sourceType === '8-K' || isProxyStatement(document.sourceType)) && highlightedElementId) {
        // Extract page number from the last four digits of the highlightedElementId
        // Format: #f2340000 where 0000 is page 1, 0001 is page 2, etc.
        const cleanId = highlightedElementId.replace('#', '');
        const pageNumberStr = cleanId.slice(-4);
        // Convert the string to a number and make it zero-based (0000 -> page 0)
        const pageNumber = parseInt(pageNumberStr, 10);
        
        // For proxy statement documents, use the injected highlightCaptidePage function
        if (isProxyStatement(document.sourceType)) {
          // The page numbers in captide-page are 1-based, while our internal pageNumber is 0-based
          const oneBasedPageNumber = pageNumber + 1;
          
          // Use a small timeout to ensure DOM is fully loaded
          setTimeout(() => {
            // Check if the highlightCaptidePage function exists
            if (typeof iframeWindow.highlightCaptidePage === 'function') {
              iframeWindow.highlightCaptidePage(oneBasedPageNumber);
            } else {
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
              }
            }
          }, 200);
          
          return; // Exit early for proxy statement documents
        }
        
        // For 8-K documents, continue with existing page container approach
        // Find all page containers
        const pageContainers = iframeDocument.querySelectorAll('.page-container');
        
        if (pageContainers && pageContainers.length > 0) {
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
          
          if (targetPage) {
            // Highlight the page
            targetPage.classList.add('page-highlighted');
            
            // Scroll to the target page
            setTimeout(() => {
              if (targetPage) {
                targetPage.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            }, 100);
          }
        }
      }
    };

    // Handle highlighting for international filings (20-F, 40-F, 6-K)
    const handleInternationalFilingHighlight = () => {
      const iframeDocument = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      if (!iframeDocument || !iframeWindow || !highlightedElementId) return;

      // For international filings, highlightedElementId is 8 characters (e.g., #c892332c)
      // We need to extract the start and end comment IDs (each 4 characters)
      const cleanId = highlightedElementId.replace('#', '');
      
      // First 4 characters represent the start marker, last 4 characters represent the end marker
      const startMarkerId = cleanId.substring(0, 4);
      const endMarkerId = cleanId.substring(4, 8);
      
      console.log(`Highlighting international filing from marker #${startMarkerId} to #${endMarkerId}`);
      
      // Look for comments with these IDs in the format <!--[[#xxxx]]-->
      const allComments = [];
      const iterator = iframeDocument.createNodeIterator(
        iframeDocument.body,
        NodeFilter.SHOW_COMMENT,
        { acceptNode: () => NodeFilter.FILTER_ACCEPT }
      );
      
      let commentNode;
      while (commentNode = iterator.nextNode()) {
        const commentText = commentNode.nodeValue?.trim();
        if (commentText && commentText.startsWith('[[#') && commentText.endsWith(']]')) {
          allComments.push({
            node: commentNode,
            id: commentText.substring(3, 7) // Extract the ID from [[#xxxx]]
          });
        }
      }
      
      // Remove existing highlights
      const existingHighlights = iframeDocument.querySelectorAll('.highlighted');
      existingHighlights.forEach(el => {
        el.classList.remove('highlighted');
      });
      
      // Check if we have a case where start and end IDs are the same (single element highlighting)
      const isSingleElementHighlight = startMarkerId === endMarkerId;
      
      if (isSingleElementHighlight) {
        // Find all occurrences of the ID
        const markersWithId = allComments.filter(comment => comment.id === startMarkerId);
        
        if (markersWithId.length >= 2) {
          // Find pairs of comments (start/end) with the same ID
          for (let i = 0; i < markersWithId.length - 1; i++) {
            const currentComment = markersWithId[i];
            const nextComment = markersWithId[i + 1];
            
            // Find all elements between these two comments
            const elementsToHighlight = [];
            let currentNode = currentComment.node.nextSibling;
            
            while (currentNode && currentNode !== nextComment.node) {
              if (currentNode.nodeType === Node.ELEMENT_NODE) {
                elementsToHighlight.push(currentNode);
              }
              currentNode = currentNode.nextSibling;
            }
            
            // Highlight all elements found
            elementsToHighlight.forEach(el => {
              (el as Element).classList.add('highlighted');
            });
            
            // If we found elements to highlight, scroll to the first one
            if (elementsToHighlight.length > 0) {
              (elementsToHighlight[0] as HTMLElement).scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
              
              // Only highlight the first occurrence and break
              break;
            }
          }
        } else {
          console.warn(`Could not find paired comments for ID #${startMarkerId}`);
        }
        
        return;
      }
      
      // If not a single element highlight, continue with the normal start/end processing
      // Find the start and end comment nodes
      const startCommentIndex = allComments.findIndex(comment => comment.id === startMarkerId);
      const endCommentIndex = allComments.findIndex(comment => comment.id === endMarkerId);
      
      if (startCommentIndex === -1 || endCommentIndex === -1) {
        console.warn(`Could not find comment markers for #${startMarkerId} or #${endMarkerId}`);
        return;
      }
      
      // Elements to highlight are between these two comments (inclusive)
      let elementsToHighlight = [];
      
      // Get the comment nodes
      const startComment = allComments[startCommentIndex].node;
      const endComment = allComments[endCommentIndex].node;
      
      // Function to collect all elements in document order
      const collectAllElements = (root: Element | Document): Node[] => {
        const walker = iframeDocument.createTreeWalker(
          root,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
          null
        );
        
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
          nodes.push(node);
        }
        
        return nodes;
      };
      
      // Get all nodes in document order
      const allNodes = collectAllElements(iframeDocument.body);
      
      // Find the indices of our comment nodes
      const startCommentDocIndex = allNodes.findIndex(node => 
        node.nodeType === Node.COMMENT_NODE && 
        node.nodeValue?.trim() === `[[#${startMarkerId}]]`
      );
      
      const endCommentDocIndex = allNodes.findIndex(node => 
        node.nodeType === Node.COMMENT_NODE && 
        node.nodeValue?.trim() === `[[#${endMarkerId}]]`
      );
      
      if (startCommentDocIndex !== -1 && endCommentDocIndex !== -1) {
        // Get all elements between these indices (inclusive of the elements right after comments)
        for (let i = startCommentDocIndex + 1; i <= endCommentDocIndex; i++) {
          const node = allNodes[i];
          if (node && node.nodeType === Node.ELEMENT_NODE) {
            elementsToHighlight.push(node);
          }
        }
      }
      
      // Highlight all collected nodes
      elementsToHighlight.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          (node as Element).classList.add('highlighted');
        }
      });
      
      // Find a good element to scroll to (preferably the first highlighted element)
      if (elementsToHighlight.length > 0) {
        // Find the first element that's not a comment
        const firstElement = elementsToHighlight.find(node => 
          node.nodeType === Node.ELEMENT_NODE
        ) as Element;
        
        if (firstElement) {
          // Scroll to this element
          firstElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    };

    const handleLoad = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) return;

      // Add styles for document types
      if (document.sourceType === '8-K' || isProxyStatement(document.sourceType)) {
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
        iframeDocument.head.appendChild(style);
        
        // Call page-based document specific handler
        handlePageBasedDocumentLoad();
        return;
      }
      
      // Handle international filings (20-F, 40-F, 6-K)
      if (isInternationalFiling(document.sourceType)) {
        const style = iframeDocument.createElement('style');
        style.textContent = `
          /* Remove borders for international filings */
          body, div, p, span {
            border: none !important;
          }
          
          /* Highlighted elements */
          .highlighted {
            background-color: yellow !important;
          }
          .highlighted * {
            background-color: transparent !important;
          }
          
          /* Responsive layout styles */
          body {
            transform-origin: top left;
            transform: scale(${zoomLevel});
            width: ${100 / zoomLevel}%;
            overflow-x: visible;
            background-color: white;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Remove borders and allow document to flow naturally */
          div {
            border: none !important;
            background-color: transparent !important;
            max-width: none !important;
            width: auto !important;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          
          /* Ensure text doesn't get cut off */
          div > font, p > font, span > font, font {
            display: inline-block;
            max-width: none !important;
            width: auto !important;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          
          /* Allow text to wrap properly */
          p, span, div {
            white-space: normal !important;
            overflow-wrap: break-word !important;
            word-wrap: break-word !important;
          }
          
          /* Improve table rendering */
          table {
            max-width: 100%;
            table-layout: auto;
            border-collapse: collapse;
            border: none !important;
            width: auto !important;
          }
          
          /* Ensure table cells can break properly */
          td, th {
            word-break: break-word;
            overflow-wrap: break-word;
          }
          
          /* Override any container styles that might add borders */
          .page-container, 
          .captide-page, 
          div[class*="page"],
          [id*="page"] {
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: transparent !important;
            max-width: none !important;
          }
        `;
        iframeDocument.head.appendChild(style);
        
        // Call international filing specific handler
        handleInternationalFilingHighlight();
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
              
              if (elementsArray.length > 0) {
                // 1. First, directly highlight all the matching elements
                elementsArray.forEach(element => {
                  element.classList.add('highlighted');
                });
                
                // 2. Sort all highlighted elements by their document position
                elementsArray.sort((a, b) => {
                  const position = a.compareDocumentPosition(b);
                  return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
                });
                
                // 3. For each consecutive pair of highlighted elements, highlight content in between
                for (let i = 0; i < elementsArray.length - 1; i++) {
                  const currentElement = elementsArray[i];
                  const nextElement = elementsArray[i + 1];
                  
                  // Skip if elements are in completely different parts of the document
                  // Only highlight between elements that are relatively close to each other
                  const currentRect = currentElement.getBoundingClientRect();
                  const nextRect = nextElement.getBoundingClientRect();
                  const verticalDistance = Math.abs(nextRect.top - currentRect.bottom);
                  
                  // Skip if the vertical distance is too large (likely different sections)
                  if (verticalDistance > 1000) continue;
                  
                  // Find a common ancestor for both elements
                  let commonAncestor = null;
                  let currentParent = currentElement.parentElement;
                  
                  // Go up the DOM tree until we find a common ancestor
                  while (currentParent && !commonAncestor) {
                    if (currentParent.contains(nextElement)) {
                      commonAncestor = currentParent;
                    } else {
                      currentParent = currentParent.parentElement;
                    }
                  }
                  
                  if (!commonAncestor) continue;
                  
                  // Create a document range between the two elements
                  const range = iframeDocument.createRange();
                  range.setStartAfter(currentElement);
                  range.setEndBefore(nextElement);
                  
                  // Highlight all elements within the range
                  highlightElementsInRange(range, commonAncestor, iframeDocument);
                }
              }
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
                  // Calculate desired position - we want the element at the top
                  // with just a small margin (20px) for context
                  
                  // Get current scroll position and viewport height
                  const currentScrollY = contentWindow.scrollY;
                  const viewportHeight = contentWindow.innerHeight;
                  
                  // Get target's position relative to the document
                  const docElement = contentDocument.documentElement;
                  const targetOffsetTop = targetRect.top + currentScrollY;
                  
                  // Calculate the ideal scroll position (element at top with small margin)
                  const idealScrollPosition = targetOffsetTop - 20;
                  
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
                    
                    // Scroll to position the container at the top with small margin
                    contentWindow.scrollTo({
                      top: containerTop - 20, // Position with small space above
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
                const contentWindow = iframe.contentWindow;
                const contentDocument = iframe.contentDocument;
                
                if (!contentWindow || !contentDocument) {
                  console.error('Cannot access iframe content window or document');
                  return;
                }
                
                // Find the topmost highlighted element in document order
                const findTopmostHighlightedElement = () => {
                  // Get all highlighted elements
                  const allHighlighted = contentDocument.querySelectorAll('.highlighted');
                  if (allHighlighted.length === 0) return scrollTarget;
                  
                  // Convert to array and sort by document position
                  return Array.from(allHighlighted).sort((a, b) => {
                    const position = a.compareDocumentPosition(b);
                    // DOCUMENT_POSITION_FOLLOWING means 'a' comes before 'b'
                    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                    return 0;
                  })[0]; // Take the first element in document order
                };
                
                // Define a function to scroll to the element with retry capability
                const scrollToHighlightedElement = (attempt = 1, maxAttempts = 3) => {
                  // Find the topmost highlighted element
                  const topmostElement = findTopmostHighlightedElement();
                  
                  // Get fresh positions as they might have changed
                  const freshRect = topmostElement.getBoundingClientRect();
                  
                  // Check if element is properly positioned (has height/width)
                  const hasValidDimensions = freshRect.height > 0 && freshRect.width > 0;
                  
                  if (hasValidDimensions) {
                    // Calculate the absolute position of the element relative to the document
                    // Add a small margin at top for better visibility
                    const absoluteTop = freshRect.top + contentWindow.scrollY - 20;
                    
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
                    const finalScrollTarget = topmostElement.closest('div') || 
                                          topmostElement.parentElement || 
                                          topmostElement;
                    
                    finalScrollTarget.scrollIntoView({ 
                      behavior: 'auto',
                      block: 'start'
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
                  block: 'start'
                });
              }
            }
          }
        }, delay);
      }

      // Add general styles for all document types
      const generalStyle = iframeDocument.createElement('style');
      generalStyle.textContent = `
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
      iframeDocument.head.appendChild(generalStyle);
    };

    // Get HTML content based on document type
    let htmlContent: string;
    let documentIdentifier: string | null = null;
    
    htmlContent = document.htmlContent || '';
    documentIdentifier = document.sourceLink;
    
    // Special handling for 8-K documents to process page breaks
    // For proxy statement documents, keep the original HTML as it already has our custom page markers
    if (document.sourceType === '8-K') {
      htmlContent = processHtmlForPageBreaks(htmlContent);
    }

    const formattedHtmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html, body { 
              margin: 0; 
              padding: 0;
              overflow-x: hidden; /* Prevent horizontal scrolling */
              overflow-y: auto;   /* Allow vertical scrolling */
              width: 100%;
            }
            
            /* Natural wrapping of content */
            * {
              max-width: 100%;
              box-sizing: border-box;
            }
            
            /* Add resize event listener to handle content reflow */
            ${document?.sourceType === '10-K' || document?.sourceType === '10-Q' || document?.sourceType === 'DEF 14A' ? `
              body {
                height: auto !important;
                min-height: 100%;
              }
            ` : ''}
            
            /* Handle tables naturally */
            table {
              max-width: 100%;
              width: auto;
            }
            
            /* Highlighted elements */
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
          </script>
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

  // Add a resize listener in the parent component
  useEffect(() => {
    const handleIframeResize = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize') {
        // You could adjust the container or iframe height here if needed
        console.log('Content height changed:', event.data.height);
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

  // Helper function to highlight elements in a range between two highlighted elements
  function highlightElementsInRange(range: Range, commonAncestor: Element, iframeDocument: Document): void {
    // Create a tree walker to iterate through all elements in the common ancestor
    const walker = iframeDocument.createTreeWalker(
      commonAncestor,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function(node: Node): number {
          // Skip elements that are already highlighted
          if ((node as Element).classList && (node as Element).classList.contains('highlighted')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Accept nodes that are fully contained within the range
          if (range.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_SKIP;
        }
      } as NodeFilter
    );
    
    // Walk through all elements in the range and highlight them
    let currentNode = walker.nextNode() as Element | null;
    while (currentNode) {
      // Only highlight elements that contain direct text content or are tables
      const shouldHighlight = (
        // Table elements
        currentNode.tagName === 'TABLE' || 
        currentNode.tagName === 'TR' || 
        currentNode.tagName === 'TD' || 
        currentNode.tagName === 'TH' ||
        // Elements with direct text content
        (currentNode.childNodes && Array.from(currentNode.childNodes).some((child: ChildNode) => 
          child.nodeType === Node.TEXT_NODE && 
          child.textContent && 
          child.textContent.trim().length > 0
        )) ||
        // Special elements that should always be highlighted
        currentNode.tagName === 'IX:NONFRACTION' ||
        currentNode.tagName === 'SPAN' ||
        // For tables, highlight the table container too
        currentNode.classList && (
          currentNode.classList.contains('table') || 
          currentNode.classList.contains('financial-table')
        )
      );
      
      if (shouldHighlight) {
        currentNode.classList.add('highlighted');
      }
      
      currentNode = walker.nextNode() as Element | null;
    }
    
    // Special handling for tables - make sure we catch the entire table
    const tables = commonAncestor.querySelectorAll('table');
    tables.forEach((table: Element) => {
      // Check if any part of the table is within the range
      if (range.intersectsNode(table)) {
        // Highlight the table and all its child elements
        table.classList.add('highlighted');
        const tableElements = table.querySelectorAll('*');
        tableElements.forEach((el: Element) => {
          el.classList.add('highlighted');
        });
      }
    });
  }

  if (isLoading) {
    return <div className={className} style={style}>Loading document...</div>;
  }

  if (!document) {
    return <div className={className} style={style}>No document selected</div>;
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
        // Add a tabIndex to make the iframe focusable by keyboard
        tabIndex={0}
      />
    </div>
  );
};

export default DocumentViewer; 