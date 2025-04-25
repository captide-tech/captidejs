import { generateShareableLink } from '../../../utils/shareableLinks';

/**
 * Setup shareable link buttons for highlighted elements
 * @param iframeRef React ref for the iframe
 * @param shareableLinkButtonColor Button color
 * @param document Document object
 * @param highlightedElementId ID of the highlighted element
 * @param areShareableLinksEnabled Whether shareable links are enabled
 * @returns void
 */
export const setupShareableLinkButtons = (
  iframeRef: React.RefObject<HTMLIFrameElement>,
  shareableLinkButtonColor: string,
  document: any,
  highlightedElementId: string | null,
  areShareableLinksEnabled: boolean
): void => {
  if (!areShareableLinksEnabled || !iframeRef.current || !iframeRef.current.contentDocument) {
    return;
  }

  const iframeDocument = iframeRef.current.contentDocument;
  const iframeWindow = iframeRef.current.contentWindow;
  
  if (!iframeDocument || !iframeWindow) {
    return;
  }
  
  // First, clean up any existing buttons
  const existingButtons = iframeDocument.querySelectorAll('.shareable-link-button');
  existingButtons.forEach(button => button.remove());
  
  // Add global styles for buttons
  let linkButtonStyle = iframeDocument.getElementById('shareable-link-button-styles');
  if (!linkButtonStyle) {
    linkButtonStyle = iframeDocument.createElement('style');
    linkButtonStyle.id = 'shareable-link-button-styles';
    iframeDocument.head.appendChild(linkButtonStyle);
  }
  
  linkButtonStyle.textContent = `
    .shareable-link-button {
      position: absolute !important;
      top: -10px !important;
      left: 5px !important;
      width: 28px !important;
      height: 28px !important;
      min-width: 28px !important;
      min-height: 28px !important;
      background-color: ${shareableLinkButtonColor} !important;
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
      background-color: ${shareableLinkButtonColor} !important;
    }
    
    .shareable-link-button:hover {
      background-color: ${shareableLinkButtonColor === '#2563eb' ? '#1d4ed8' : shareableLinkButtonColor} !important;
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
  
  // Create a function to add a button to an element
  const addButtonToElement = (element: Element, elementId: string, isPage = false) => {
    // Ensure the element has position relative for absolute positioning of children
    (element as HTMLElement).style.position = 'relative';
    
    // Create the button element
    const linkButton = iframeDocument.createElement('button');
    linkButton.className = 'shareable-link-button';
    linkButton.title = isPage ? 'Click to copy link to this page' : 'Click to copy link to this highlight';
    linkButton.setAttribute('data-share-id', elementId);
    
    // Add inline styles for maximum compatibility
    linkButton.style.position = 'absolute';
    linkButton.style.top = '-10px';
    linkButton.style.left = '5px';
    linkButton.style.width = '24px';
    linkButton.style.height = '24px';
    linkButton.style.minWidth = '24px';
    linkButton.style.minHeight = '24px';
    linkButton.style.backgroundColor = shareableLinkButtonColor;
    linkButton.style.color = 'white';
    linkButton.style.borderRadius = '50%';
    linkButton.style.display = 'flex';
    linkButton.style.alignItems = 'center';
    linkButton.style.justifyContent = 'center';
    linkButton.style.cursor = 'pointer';
    linkButton.style.border = '2px solid white';
    linkButton.style.zIndex = '100000';
    linkButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    linkButton.style.opacity = '0';
    linkButton.style.visibility = 'hidden';
    
    // Use a variable to track the copied state
    let isCopied = false;
    
    // Add event handlers to ensure consistent styling
    // For hover effect
    linkButton.addEventListener('mouseenter', () => {
      linkButton.style.transform = 'scale(1.1)';
      linkButton.style.opacity = '1';
      // Always ensure the background color is set when hovering directly over the button
      linkButton.style.backgroundColor = shareableLinkButtonColor === '#2563eb' ? '#1d4ed8' : shareableLinkButtonColor;
    });
    
    // For hover out effect
    linkButton.addEventListener('mouseleave', () => {
      linkButton.style.transform = 'scale(1)';
      // Ensure the background color is preserved on mouse leave
      linkButton.style.backgroundColor = shareableLinkButtonColor;
      linkButton.style.opacity = '0.9';
    });
    
    // SVG to use based on copied state
    const updateButtonIcon = (copied = false) => {
      // Show either checkmark or chain link icon
      linkButton.innerHTML = copied 
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>`;
    };
    
    // Initial icon
    updateButtonIcon();
    
    // Add click handler to copy link directly
    linkButton.addEventListener('click', async (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      
      // Copy the link to clipboard
      if (document) {
        const success = await copyLinkToClipboard(document.sourceLink, elementId);
        
        if (success) {
          // Track copied state
          isCopied = true;
          
          // Show checkmark and ensure background color is preserved
          updateButtonIcon(true);
          linkButton.style.backgroundColor = shareableLinkButtonColor;
          
          // Revert back to chain icon after 2 seconds
          setTimeout(() => {
            isCopied = false;
            updateButtonIcon(false);
            
            // Always reset the background color when returning to normal state
            linkButton.style.backgroundColor = shareableLinkButtonColor;
          }, 2000);
        }
      }
    });
    
    // Add the button to the element
    element.appendChild(linkButton);
  };
  
  // Handle normal documents (not 8-K)
  if (document?.sourceType !== '8-K') {
    const highlightedElements = iframeDocument.querySelectorAll('.highlighted');
    
    if (highlightedElements.length > 0) {
      // Convert NodeList to Array for sorting
      const elementsArray = Array.from(highlightedElements);
      
      // Sort elements by document position to find the first one
      elementsArray.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      
      // Get the first highlighted element
      const firstElement = elementsArray[0];
      
      // Add 'first-highlighted' class to add margin
      firstElement.classList.add('first-highlighted');
      
      // Get element ID for the sharing
      const uniqueId = firstElement.getAttribute('unique_id') || 
                     firstElement.getAttribute('unique-id') || 
                     firstElement.getAttribute('id');
      
      // Custom ID for the tooltip or use highlightedElementId
      const elementId = uniqueId ? `#${uniqueId.replace(/[#\[\]]/g, '')}` : highlightedElementId;
      
      if (elementId) {
        // Add button to only the first highlighted element
        addButtonToElement(firstElement, elementId);
        
        // Add event listener to all highlighted elements to show the button
        // when hovering over any part of the highlight
        highlightedElements.forEach((element) => {
          element.addEventListener('mouseenter', () => {
            const shareButton = firstElement.querySelector('.shareable-link-button');
            if (shareButton) {
              (shareButton as HTMLElement).style.visibility = 'visible';
              (shareButton as HTMLElement).style.opacity = '0.9';
            }
          });
          
          element.addEventListener('mouseleave', () => {
            const shareButton = firstElement.querySelector('.shareable-link-button');
            if (shareButton) {
              // Only hide if we're not hovering over the button itself
              if (!shareButton.matches(':hover')) {
                (shareButton as HTMLElement).style.visibility = 'hidden';
                (shareButton as HTMLElement).style.opacity = '0';
              }
            }
          });
        });
      }
    }
  }
  // Process 8-K document pages
  else if (document?.sourceType === '8-K') {
    const pageContainers = iframeDocument.querySelectorAll('.page-container.page-highlighted');
    
    pageContainers.forEach(element => {
      const pageNumber = element.getAttribute('data-page');
      if (pageNumber !== null) {
        // Format the page ID 
        const pageId = `#f234${pageNumber.padStart(4, '0')}`;
        addButtonToElement(element, pageId, true);
      }
    });
  }
};

/**
 * Copy link to clipboard
 * @param sourceLink Document source link
 * @param elementId Element ID
 * @param shareableLinkBaseUrl Base URL for shareable links
 * @param viewerRoutePath Viewer route path
 * @returns Promise<boolean> Success status
 */
export const copyLinkToClipboard = async (
  sourceLink: string, 
  elementId: string,
  shareableLinkBaseUrl?: string,
  viewerRoutePath: string = 'document-viewer'
): Promise<boolean> => {
  try {
    const shareableLink = generateShareableLink(sourceLink, elementId, shareableLinkBaseUrl, viewerRoutePath);
    await navigator.clipboard.writeText(shareableLink);
    return true;
  } catch (error) {
    return false;
  }
}; 