/**
 * Turns the browser's text selection over the PDF text layer into an anchor a
 * host can put in a link.
 */

import type { HighlightAnchor } from '../types';
import { countOccurrences, normalizeText } from './text-matching';

/** PDF.js sets this on each rendered page container. */
const PAGE_ATTRIBUTE = 'data-page-number';

export const readSelectionAnchor = (container: HTMLElement | null): HighlightAnchor | null => {
  if (!container || typeof window === 'undefined') return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const text = selection.toString().replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const pageElement = closestPage(range.startContainer);
  const page = pageNumberOf(pageElement);
  if (!pageElement || !page) return { text };

  return { text, page, matchIndex: occurrenceIndex(range, pageElement, text) };
};

const closestPage = (node: Node): Element | null => {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest(`[${PAGE_ATTRIBUTE}]`) ?? null;
};

const pageNumberOf = (pageElement: Element | null): number | undefined => {
  const parsed = parseInt(pageElement?.getAttribute(PAGE_ATTRIBUTE) ?? '', 10);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Which occurrence of the selected text this is, counted from the top of the
 * page, so a link to a phrase that repeats lands on the one the user picked.
 */
const occurrenceIndex = (range: Range, pageElement: Element, text: string): number => {
  const beforeSelection = pageElement.ownerDocument.createRange();
  beforeSelection.selectNodeContents(pageElement);
  try {
    beforeSelection.setEnd(range.startContainer, range.startOffset);
  } catch (_) {
    return 1;
  }

  return countOccurrences(normalizeText(beforeSelection.toString()), normalizeText(text)) + 1;
};
