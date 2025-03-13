import React, { useEffect, useRef } from 'react';
import { useDocumentViewer } from '../contexts/DocumentViewerContext';

interface DocumentViewerProps {
  /**
   * Optional custom CSS class name
   */
  className?: string;
  
  /**
   * Optional inline styles
   */
  style?: React.CSSProperties;
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
 */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  className = 'w-full h-full',
  style
}) => {
  const { document, sourceType, highlightedElementId, isLoading } = useDocumentViewer();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previousDocumentRef = useRef<string | null>(null);
  const previousSourceTypeRef = useRef<string | null>(null);

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

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !document) return;

    // Add early logging to debug document type
    console.log("DocumentViewer received document:", {
      type: sourceType,
      keys: Object.keys(document)
    });

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

    // Handle Load specifically for 8-K documents
    const handle8kLoad = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) return;

      // For 8-K documents, we need to highlight the correct page
      if (sourceType === '8-K' && document.pageNumber !== undefined) {
        const pageNumber = document.pageNumber || 0; // Use 0 as default if undefined
        console.log(`Highlighting page ${pageNumber} for 8-K document`);
        
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
          // First, try to find by data-page attribute matching the pageNumber
          let targetPage = null;
          
          // In the simplified version, data-page should match array index, so we can just use pageNumber
          // But ensure we don't go out of bounds
          const targetPageIndex = Math.min(pageNumber as number, pageContainers.length - 1);
          targetPage = pageContainers[targetPageIndex];
          
          console.log(`Target page index: ${targetPageIndex}`);
          
          if (targetPage) {
            // Highlight the page
            targetPage.classList.add('page-highlighted');
            console.log(`Highlighted page ${targetPageIndex}`);
            
            // Scroll to the target page
            setTimeout(() => {
              targetPage.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
              });
              console.log(`Scrolled to page ${targetPageIndex}`);
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

      // Add styles specifically for 8-K documents
      if (sourceType === '8-K') {
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
        `;
        iframeDocument.head.appendChild(style);
        
        // Call 8-K specific handler
        handle8kLoad();
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
                             previousSourceTypeRef.current !== sourceType;
        const delay = isNewDocument ? 500 : 0;

        setTimeout(() => {
          // Find all elements with matching ID
          const elementsToHighlight = iframeDocument.querySelectorAll(
            `[unique_id*="${cleanId}"], [unique-id*="${cleanId}"], [unique-id*="#${cleanId}"], [id*="[#${cleanId}]"]`
          );

          if (elementsToHighlight.length > 0) {
            // Highlight all matching elements
            elementsToHighlight.forEach(element => {
              element.classList.add('highlighted');
            });

            // Find the best element to scroll to
            const scrollTarget = findBestScrollTarget(elementsToHighlight);
            
            if (scrollTarget) {
              if (sourceType === 'transcript') {
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
              } else {
                // For filings, use the original approach with improvements
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
    };

    // Get HTML content based on document type
    let htmlContent: string;
    let documentIdentifier: string | null = null;
    
    htmlContent = document.htmlContent || '';
    documentIdentifier = document.sourceLink;
    
    // Special handling for 8-K documents to process page breaks
    if (sourceType === '8-K') {
      htmlContent = processHtmlForPageBreaks(htmlContent);
    }

    const formattedHtmlContent = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; }
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

    if (previousDocumentRef.current !== documentIdentifier || 
        previousSourceTypeRef.current !== sourceType) {
      iframe.srcdoc = formattedHtmlContent;
      previousDocumentRef.current = documentIdentifier;
      previousSourceTypeRef.current = sourceType;
    } else {
      handleLoad();
    }

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [document, sourceType, highlightedElementId]);

  if (isLoading) {
    return <div className={className} style={style}>Loading document...</div>;
  }

  if (!document) {
    return <div className={className} style={style}>No document selected</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      className={className}
      style={style}
      sandbox="allow-same-origin allow-popups"
    />
  );
};

export default DocumentViewer; 