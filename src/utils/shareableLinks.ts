/**
 * Generates a shareable link for a highlighted document element
 * 
 * @param sourceLink The document's source link
 * @param elementId The highlighted element ID (with # prefix)
 * @param baseUrl The base URL of the application (defaults to current origin)
 * @param viewerRoutePath The route path to use for the document viewer (defaults to '/document-viewer')
 * @returns A fully qualified shareable URL
 */
export function generateShareableLink(
    sourceLink: string,
    elementId: string | null,
    baseUrl: string = window.location.origin,
    viewerRoutePath: string = '/document-viewer'
  ): string {
    // Handle base URL formatting
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Ensure viewerRoutePath starts with '/'
    if (!viewerRoutePath.startsWith('/')) {
      viewerRoutePath = '/' + viewerRoutePath;
    }
    
    // Create the URL with parameters
    const url = new URL(`${baseUrl}${viewerRoutePath}`);
    
    // Add parameters
    url.searchParams.append('sourceLink', encodeURIComponent(sourceLink));
    if (elementId) {
      url.searchParams.append('elementId', elementId);
    }
    
    return url.toString();
  }
  
  /**
   * Parses document viewer parameters from a URL
   * 
   * @param url The URL to parse (defaults to current URL)
   * @returns Object containing sourceLink and elementId
   */
  export function parseDocumentViewerParams(url: string = window.location.href): { 
    sourceLink: string | null; 
    elementId: string | null;
  } {
    try {
      const parsedUrl = new URL(url);
      const sourceLink = parsedUrl.searchParams.get('sourceLink');
      const elementId = parsedUrl.searchParams.get('elementId');
      
      return {
        sourceLink: sourceLink ? decodeURIComponent(sourceLink) : null,
        elementId: elementId || null
      };
    } catch (error) {
      console.error('Failed to parse document viewer URL:', error);
      return { sourceLink: null, elementId: null };
    }
  }