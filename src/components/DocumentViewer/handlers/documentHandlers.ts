import { findBestScrollTarget } from '../utils/highlighting';
import { extractPageNumberFromElementId, isProxyStatement } from '../utils/pageUtils';

/**
 * Handle page-based document loading (8-K and proxy statements)
 * @param iframe Reference to the iframe
 * @param document Document object
 * @param highlightedElementId Highlighted element ID
 */
export const handlePageBasedDocumentLoad = (
  iframe: HTMLIFrameElement,
  document: any,
  highlightedElementId: string | null
): void => {
  const iframeDocument = iframe.contentDocument;
  const iframeWindow = iframe.contentWindow;
  if (!iframeDocument || !iframeWindow) return;

  // For 8-K and DEF 14A documents, we need to highlight the correct page
  if ((document.sourceType === '8-K' || isProxyStatement(document.sourceType)) && highlightedElementId) {
    // Extract page number from elementId
    const pageNumber = extractPageNumberFromElementId(highlightedElementId);
    
    // If page number extraction failed, exit early
    if (pageNumber === null) return;
    
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

/**
 * Handle highlighting for international filings (20-F, 40-F, 6-K, S-1)
 * @param iframe Reference to the iframe
 * @param highlightedElementId Highlighted element ID
 */
export const handleInternationalFilingHighlight = (
  iframe: HTMLIFrameElement,
  highlightedElementId: string | null
): void => {
  const iframeDocument = iframe.contentDocument;
  const iframeWindow = iframe.contentWindow;
  if (!iframeDocument || !iframeWindow || !highlightedElementId) return;

  // For international filings, highlightedElementId is 8 characters (e.g., #c892332c)
  // We need to extract the start and end comment IDs (each 4 characters)
  const cleanId = highlightedElementId.replace('#', '');
  
  // Check if this is a repeating ID pattern (e.g., #54b954b9)
  const isRepeatingIdPattern = cleanId.length === 8 && 
                             cleanId.substring(0, 4) === cleanId.substring(4, 8);
  
  // First 4 characters represent the start marker, last 4 characters represent the end marker
  // For repeating pattern like #54b954b9, both start and end markers are the same
  const startMarkerId = cleanId.substring(0, 4);
  const endMarkerId = isRepeatingIdPattern ? startMarkerId : 
                     (cleanId.length >= 8 ? cleanId.substring(4, 8) : startMarkerId);
  
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
  
  // For S-1 documents with repeated ID patterns like #54b954b9, we'll check if it's a repeating pattern
  // and treat it as a single ID highlight if it is
  const isSingleIdRepeated = cleanId.length === 8 && 
                           startMarkerId === endMarkerId;
  
  // Check if we have a case where start and end IDs are the same (single element highlighting)
  // This includes cases where the ID is repeated like #54b954b9
  const isSingleElementHighlight = startMarkerId === endMarkerId || isRepeatingIdPattern;
  
  if (isSingleElementHighlight) {
    // Find all occurrences of the ID
    const markersWithId = allComments.filter(comment => comment.id === startMarkerId);
    
    if (markersWithId.length >= 2) {
      // For S-1 documents, we want to process markers in pairs
      // For other documents, we just need to find matching pairs
      const step = isRepeatingIdPattern ? 2 : 1;
      
      // Find pairs of comments (start/end) with the same ID
      for (let i = 0; i < markersWithId.length - 1; i += step) {
        // For S-1 documents, we need to handle consecutive pairs
        const currentComment = markersWithId[i];
        // If we're near the end of the array, be careful about accessing the next element
        const nextComment = (i + 1 < markersWithId.length) ? markersWithId[i + 1] : null;
        
        if (!nextComment) {
          continue;
        }
        
        // Find all elements between these two comments
        const elementsToHighlight = [];
        let currentNode = currentComment.node.nextSibling;
        
        // For single id repeating pattern like #54b954b9, we need to highlight everything between
        // the comments with the same ID
        while (currentNode && currentNode !== nextComment.node) {
          if (currentNode.nodeType === Node.ELEMENT_NODE) {
            elementsToHighlight.push(currentNode);
          } else if (currentNode.nodeType === Node.TEXT_NODE) {
            // For S-1 documents, text nodes should be highlighted if they contain non-whitespace content
            const textContent = currentNode.textContent?.trim();
            if (textContent) {
              // Create a span to wrap the text node for highlighting
              const span = iframeDocument.createElement('span');
              span.classList.add('highlighted');
              currentNode.parentNode?.insertBefore(span, currentNode);
              span.appendChild(currentNode);
              elementsToHighlight.push(span);
              // Update currentNode to the newly created span
              currentNode = span;
            }
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
          
          // Break after the first successful pair highlighting
          break;
        }
      }
    }
    
    return;
  }
  
  // If not a single element highlight, continue with the normal start/end processing
  // Find the start and end comment nodes
  const startCommentIndex = allComments.findIndex(comment => comment.id === startMarkerId);
  const endCommentIndex = allComments.findIndex(comment => comment.id === endMarkerId);
  
  if (startCommentIndex === -1 || endCommentIndex === -1) {
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

/**
 * Handle standard document highlighting
 * @param iframe Reference to the iframe
 * @param document Document object
 * @param highlightedElementId Highlighted element ID
 * @param isNewDocument Whether this is a new document
 * @param highlightElementsInRange Function to highlight elements in a range
 */
export const handleStandardDocumentHighlight = (
  iframe: HTMLIFrameElement,
  document: any,
  highlightedElementId: string | null,
  isNewDocument: boolean,
  highlightElementsInRange: (range: Range, commonAncestor: Element, iframeDocument: Document) => void
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
        const scrollTarget = findBestScrollTarget(elementsToHighlight, document.sourceType);
        
        if (scrollTarget) {
          handleElementScrolling(iframe, scrollTarget, document.sourceType, isNewDocument);
        }
      }
    }, delay);
  }
};

/**
 * Handle scrolling to the highlighted element
 * @param iframe Reference to the iframe
 * @param scrollTarget Element to scroll to
 * @param sourceType Document source type
 * @param isNewDocument Whether this is a new document
 */
export const handleElementScrolling = (
  iframe: HTMLIFrameElement,
  scrollTarget: Element,
  sourceType: string,
  isNewDocument: boolean
): void => {
  if (sourceType === 'transcript') {
    handleTranscriptScrolling(iframe, scrollTarget, isNewDocument);
  } else if (sourceType === '10-K' || sourceType === '10-Q') {
    handle10KScrolling(iframe, scrollTarget, isNewDocument);
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
};

/**
 * Handle scrolling for transcript documents
 */
const handleTranscriptScrolling = (
  iframe: HTMLIFrameElement, 
  scrollTarget: Element,
  isNewDocument: boolean
): void => {
  // For transcripts, we need to be more precise about scrolling
  // Get the exact position of the highlighted element
  const targetRect = scrollTarget.getBoundingClientRect();
  
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
};

/**
 * Handle scrolling for 10-K and 10-Q documents
 */
const handle10KScrolling = (
  iframe: HTMLIFrameElement,
  scrollTarget: Element,
  isNewDocument: boolean
): void => {
  // Enhanced handling for 10-K and 10-Q documents with reliable scrolling
  const contentWindow = iframe.contentWindow;
  const contentDocument = iframe.contentDocument;
  
  if (!contentWindow || !contentDocument) {
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
}; 