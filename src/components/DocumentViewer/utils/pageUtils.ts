/**
 * Utility functions for handling page-based operations in document viewers
 */

/**
 * Extracts page number from elementId
 * Format: #f2340000 where 0000 is page 1, 0001 is page 2, etc.
 * 
 * @param elementId The element ID in the format #xxxxxxxx
 * @returns The zero-based page number (0 for first page)
 */
export const extractPageNumberFromElementId = (elementId: string | null): number | null => {
  if (!elementId) return null;
  
  const cleanId = elementId.replace('#', '');
  
  // ElementId should be 8 characters
  if (cleanId.length !== 8) return null;
  
  // Extract page number from the last four digits
  const pageNumberStr = cleanId.slice(-4);
  
  // Convert the string to a number (zero-based, 0000 -> page 0)
  return parseInt(pageNumberStr, 10);
};

/**
 * Checks if a document type is a proxy statement
 * 
 * @param sourceType The source type to check
 * @returns Whether the document is a proxy statement
 */
export const isProxyStatement = (sourceType: string): boolean => {
  const normalizedType = sourceType.toUpperCase();
  return ['DEF 14A', 'DEFM14A', 'DEF 14C', 'DEFM14C'].includes(normalizedType);
}; 