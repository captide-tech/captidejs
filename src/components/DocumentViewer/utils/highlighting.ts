/**
 * Highlight elements in a range between two highlighted elements
 * @param range Document range
 * @param commonAncestor Common ancestor element
 * @param iframeDocument Iframe document
 */
export function highlightElementsInRange(range: Range, commonAncestor: Element, iframeDocument: Document): void {
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

/**
 * Finds the most relevant scroll target among multiple highlighted elements.
 * @param elements - NodeList of highlighted elements
 * @param sourceType - Document source type
 * @returns The element to scroll to
 */
export const findBestScrollTarget = (elements: NodeListOf<Element>, sourceType: string): Element | null => {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0];

  // Convert NodeList to array for easier manipulation
  const elementsArray = Array.from(elements);

  // For transcript documents, prioritize certain element types
  if (sourceType.toLowerCase() === 'transcript') {
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