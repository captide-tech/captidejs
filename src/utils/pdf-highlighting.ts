/**
 * PDF Highlighting Utility
 *
 * Finds a passage in a rendered PDF and paints it, one rectangle per line of
 * text, over the page. Text matching itself lives in ./text-matching.
 */

import { findNormalizedMatch, normalizeText, type NormalizedMatch } from './text-matching';

export const HIGHLIGHT_CLASS_NAME = 'pdf-rectangle-highlight';

/** How much of an item's width the match covers, for the partly-covered items at each end. */
export interface MatchedTextItem {
  item: any;
  startFraction: number;
  endFraction: number;
}

export interface HighlightPageMatch {
  page: number;
  items: MatchedTextItem[];
}

/** More than one page only when the passage straddles a page break. */
export interface HighlightResult {
  pages: HighlightPageMatch[];
}

export interface CurrentHighlight {
  elements: HTMLElement[];
  page: number;
  text: string;
  matchIndex?: number;
}

interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Sleep helper for retry/backoff flows
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait until a page view is ready (its container div and viewport exist).
 * Polls until ready or timeout.
 */
const waitForPageReady = async (
  pdfViewerInstance: any,
  pageNumber: number,
  timeoutMs: number = 2000,
  pollIntervalMs: number = 50
): Promise<any | null> => {
  const start = Date.now();
  const targetIndex = Math.max(0, pageNumber - 1);
  while (Date.now() - start < timeoutMs) {
    try {
      const pageView = pdfViewerInstance?.getPageView?.(targetIndex);
      if (pageView?.div && pageView?.viewport) {
        return pageView;
      }
    } catch (_) {
      // ignore and retry
    }
    await sleep(pollIntervalMs);
  }
  return null;
};

/**
 * Normalized text of a page, alongside the items it was built from so match
 * offsets can be mapped back to coordinates.
 */
interface PageText {
  items: any[];
  normalizedItems: string[];
  normalized: string;
}

const extractPageText = async (pdfViewerInstance: any, pageNumber: number): Promise<PageText | null> => {
  try {
    const pageView = pdfViewerInstance.getPageView(pageNumber - 1);
    if (!pageView?.pdfPage) return null;
    const textContent = await pageView.pdfPage.getTextContent();
    const items: any[] = textContent.items;
    const normalizedItems = items.map((item: any) => normalizeText(item.str ?? ''));
    return { items, normalizedItems, normalized: normalizedItems.join('') };
  } catch (error) {
    return null;
  }
};

type PageTextReader = (pageNumber: number) => Promise<PageText | null>;

/**
 * A page is read twice — once alone, once as half of a page-break pair — so two
 * entries buy all the reuse there is. Keeping more would hold the text items of
 * every page of a long filing at once.
 */
const CACHED_PAGES = 2;

const pageTextReader = (pdfViewerInstance: any): PageTextReader => {
  const cache = new Map<number, Promise<PageText | null>>();
  return (pageNumber: number) => {
    const cached = cache.get(pageNumber);
    if (cached) return cached;
    const pending = extractPageText(pdfViewerInstance, pageNumber);
    cache.set(pageNumber, pending);
    if (cache.size > CACHED_PAGES) {
      cache.delete(cache.keys().next().value as number);
    }
    return pending;
  };
};

const matchedItemsForRange = (
  items: any[],
  normalizedItems: string[],
  match: NormalizedMatch
): MatchedTextItem[] => {
  const matched: MatchedTextItem[] = [];
  let cursor = 0;

  for (let index = 0; index < items.length; index += 1) {
    const length = normalizedItems[index].length;
    const itemStart = cursor;
    const itemEnd = cursor + length;
    cursor = itemEnd;

    if (length === 0 || itemEnd <= match.start || itemStart >= match.end) continue;

    matched.push({
      item: items[index],
      startFraction: (Math.max(itemStart, match.start) - itemStart) / length,
      endFraction: (Math.min(itemEnd, match.end) - itemStart) / length
    });
  }

  return matched;
};

const findOnPage = async (
  readPageText: PageTextReader,
  pageNumber: number,
  normalizedSearchText: string,
  matchIndex?: number
): Promise<HighlightResult | null> => {
  const pageText = await readPageText(pageNumber);
  if (!pageText) return null;

  const match = findNormalizedMatch(pageText.normalized, normalizedSearchText, matchIndex);
  if (!match) return null;

  const items = matchedItemsForRange(pageText.items, pageText.normalizedItems, match);
  return items.length > 0 ? { pages: [{ page: pageNumber, items }] } : null;
};

/**
 * A selection dragged over a page break exists on neither page alone, so match
 * the two pages as one string and split the result back at the seam.
 */
const findAcrossPageBreak = async (
  readPageText: PageTextReader,
  pageNumber: number,
  normalizedSearchText: string,
  matchIndex?: number
): Promise<HighlightResult | null> => {
  const first = await readPageText(pageNumber);
  const second = await readPageText(pageNumber + 1);
  if (!first || !second) return null;

  const seam = first.normalized.length;
  const match = findNormalizedMatch(
    first.normalized + second.normalized,
    normalizedSearchText,
    matchIndex
  );
  if (!match || match.start >= seam || match.end <= seam) return null;

  const pages = [
    {
      page: pageNumber,
      items: matchedItemsForRange(first.items, first.normalizedItems, { start: match.start, end: seam })
    },
    {
      page: pageNumber + 1,
      items: matchedItemsForRange(second.items, second.normalizedItems, { start: 0, end: match.end - seam })
    }
  ].filter(pageMatch => pageMatch.items.length > 0);

  return pages.length > 0 ? { pages } : null;
};

/**
 * Find text in PDF and return the matching text items with the fraction of each
 * that the match covers.
 */
export const findTextInPDF = async (
  searchText: string,
  pdfViewerInstance: any,
  options: { targetPage?: number; matchIndex?: number } = {}
): Promise<HighlightResult | null> => {
  if (!searchText || !pdfViewerInstance || !pdfViewerInstance.pagesCount) return null;

  const normalizedSearchText = normalizeText(searchText);
  if (!normalizedSearchText) return null;

  const { targetPage, matchIndex } = options;
  const readPageText = pageTextReader(pdfViewerInstance);
  const pagesToSearch = targetPage
    ? [targetPage]
    : Array.from({ length: pdfViewerInstance.pagesCount }, (_, i) => i + 1);

  for (const pageNumber of pagesToSearch) {
    const result = await findOnPage(readPageText, pageNumber, normalizedSearchText, matchIndex);
    if (result) return result;
  }

  // Only a known page earns the pairwise pass: over a whole document it would
  // re-scan every page, and a passage link always carries the page it came from.
  if (!targetPage) return null;

  for (const pageNumber of pagesToSearch) {
    if (pageNumber >= pdfViewerInstance.pagesCount) continue;
    const result = await findAcrossPageBreak(readPageText, pageNumber, normalizedSearchText, matchIndex);
    if (result) return result;
  }

  return null;
};

/**
 * One rect per line of text. A single rect spanning a multi-line match would
 * cover the margins and anything indented beside it.
 */
export const buildLineRects = (matched: MatchedTextItem[], viewport: any): PageRect[] => {
  return groupIntoLines(matched).map(line => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const { item, startFraction, endFraction } of line) {
      const x = item.transform[4];
      const y = item.transform[5];
      minX = Math.min(minX, x + item.width * startFraction);
      maxX = Math.max(maxX, x + item.width * endFraction);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + item.height);
    }

    const [x1, y1] = viewport.convertToViewportPoint(minX, minY);
    const [x2, y2] = viewport.convertToViewportPoint(maxX, maxY);

    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  });
};

const groupIntoLines = (matched: MatchedTextItem[]): MatchedTextItem[][] => {
  const lines: MatchedTextItem[][] = [];

  for (const entry of matched) {
    const { item } = entry;
    if (!item?.transform || !item.width || !item.height) continue;

    const baseline = item.transform[5];
    const tolerance = Math.max(1, item.height * 0.5);
    const line = lines.find(
      candidate => Math.abs(candidate[0].item.transform[5] - baseline) <= tolerance
    );

    if (line) {
      line.push(entry);
    } else {
      lines.push([entry]);
    }
  }

  return lines;
};

const createRectElement = (rect: PageRect): HTMLElement => {
  const element = document.createElement('div');
  element.className = HIGHLIGHT_CLASS_NAME;

  const padding = Math.min(2, rect.width * 0.1, rect.height * 0.1);
  const offsetY = -Math.min(2, rect.height * 0.1);

  element.style.left = `${rect.left - padding}px`;
  element.style.top = `${rect.top - padding - offsetY}px`;
  element.style.width = `${rect.width + padding * 2}px`;
  element.style.height = `${rect.height + padding * 2}px`;

  return element;
};

/**
 * React strict mode renders twice, so stale rectangles from the previous pass
 * have to go before new ones are appended.
 */
const removeRenderedHighlights = (pdfViewerInstance: any): void => {
  const root: ParentNode | null = pdfViewerInstance?.container ?? null;
  if (!root) return;
  root.querySelectorAll(`.${HIGHLIGHT_CLASS_NAME}`).forEach(element => element.remove());
};

const isSameHighlight = (
  highlight: CurrentHighlight,
  searchText: string,
  page: number,
  matchIndex?: number
): boolean => {
  return (
    highlight.text === searchText &&
    highlight.page === page &&
    highlight.matchIndex === matchIndex &&
    isHighlightConnected(highlight)
  );
};

export const createRectangleHighlight = async ({
  searchText,
  pdfViewerInstance,
  targetPage,
  matchIndex,
  currentHighlight = null,
  forceRecreate = false,
  shouldNavigateOnMatch = true
}: {
  searchText: string;
  pdfViewerInstance: any;
  targetPage?: number;
  matchIndex?: number;
  currentHighlight?: CurrentHighlight | null;
  forceRecreate?: boolean;
  shouldNavigateOnMatch?: boolean;
}): Promise<CurrentHighlight | null> => {
  if (!searchText || !pdfViewerInstance || !pdfViewerInstance.pagesCount) return null;

  const existingPage = targetPage || pdfViewerInstance.currentPageNumber;
  if (
    currentHighlight &&
    !forceRecreate &&
    isSameHighlight(currentHighlight, searchText, existingPage, matchIndex)
  ) {
    return currentHighlight;
  }

  // Retry find and place highlight while pages/text may still be initializing
  const maxAttempts = 20; // ~2s at 100ms interval
  const retryDelayMs = 100;
  let attempt = 0;
  let result: HighlightResult | null = null;
  while (attempt < maxAttempts) {
    result = await findTextInPDF(searchText, pdfViewerInstance, { targetPage, matchIndex });
    if (result) break;
    await sleep(retryDelayMs);
    attempt += 1;
  }
  if (!result) return null;

  const firstPage = result.pages[0].page;

  // Don't auto-navigate when user is scrolling around
  if (shouldNavigateOnMatch && targetPage && firstPage !== pdfViewerInstance.currentPageNumber) {
    try {
      if (firstPage >= 1 && firstPage <= pdfViewerInstance.pagesCount) {
        pdfViewerInstance.currentPageNumber = Number(firstPage);
      }
    } catch (err) {
      console.warn('Failed to navigate to page for highlighting:', firstPage, err);
    }
  }

  removeRenderedHighlights(pdfViewerInstance);

  const elements: HTMLElement[] = [];
  for (const pageMatch of result.pages) {
    const pageView = await waitForPageReady(pdfViewerInstance, pageMatch.page);
    if (!pageView) continue;

    const rects = buildLineRects(pageMatch.items, pageView.viewport);
    if (rects.length === 0) continue;

    const pageDiv: HTMLElement = pageView.div;
    pageDiv.style.position = 'relative';
    for (const rect of rects) {
      const element = createRectElement(rect);
      pageDiv.appendChild(element);
      elements.push(element);
    }
  }

  if (elements.length === 0) return null;

  if (shouldNavigateOnMatch) {
    elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { elements, page: firstPage, text: searchText, matchIndex };
};

export const isHighlightConnected = (highlight: CurrentHighlight | null): boolean => {
  return Boolean(highlight?.elements.length) && highlight!.elements.every(element => element.isConnected);
};

/**
 * Remove a highlight from the DOM
 */
export const removeHighlight = (highlight: CurrentHighlight | null): void => {
  highlight?.elements.forEach(element => element.remove());
};
