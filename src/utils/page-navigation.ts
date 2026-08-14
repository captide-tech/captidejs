/**
 * PDF.js scrolls on every currentPageNumber assignment, including one naming the
 * page already on screen. A citation highlight scrolls itself onto its passage,
 * so re-asserting the page underneath it drags the view back to the page top —
 * most visibly on page 1, where a deep link never changes page at all.
 */
export const goToPage = (
  pdfViewerInstance: any,
  pageNumber: number,
  citationOwnsScroll: boolean
): void => {
  if (citationOwnsScroll && pdfViewerInstance.currentPageNumber === pageNumber) return;
  pdfViewerInstance.currentPageNumber = Number(pageNumber);
};
