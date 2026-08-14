/**
 * @jest-environment jsdom
 */

import { readSelectionAnchor } from '../selection-anchor';
import { countOccurrences, findNormalizedMatch, normalizeText } from '../text-matching';

const PHRASE = 'total revenue increased';

const PARAGRAPHS = [
  `In fiscal 2023 ${PHRASE} by 4%.`,
  `In fiscal 2024 ${PHRASE} by 9%.`,
  `In fiscal 2025 ${PHRASE} by 12%.`
];

const render = (paragraphs: string[], pageNumber: number | null = 7): HTMLElement => {
  const pageAttribute = pageNumber === null ? '' : `data-page-number="${pageNumber}"`;
  document.body.innerHTML = `
    <div id="viewer">
      <div ${pageAttribute}>
        ${paragraphs.map(paragraph => `<span>${paragraph}</span>`).join('\n')}
      </div>
    </div>
  `;
  return document.getElementById('viewer') as HTMLElement;
};

const select = (spanIndex: number, phrase: string): void => {
  const textNode = document.querySelectorAll('span')[spanIndex].firstChild as Text;
  const start = textNode.textContent!.indexOf(phrase);
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, start + phrase.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
};

describe('readSelectionAnchor', () => {
  it('reads the page number off the PDF.js page container', () => {
    const container = render(PARAGRAPHS, 12);
    select(0, PHRASE);
    expect(readSelectionAnchor(container)!.page).toBe(12);
  });

  it('numbers the selected phrase by its occurrence on the page', () => {
    const container = render(PARAGRAPHS);
    select(1, PHRASE);
    expect(readSelectionAnchor(container)!.matchIndex).toBe(2);
  });

  it('collapses the whitespace a line wrap introduces', () => {
    const container = render(['Total revenue\n   increased\n by 4%.']);
    select(0, 'Total revenue\n   increased');
    expect(readSelectionAnchor(container)!.text).toBe('Total revenue increased');
  });

  it('omits the page when the selection sits outside a page container', () => {
    const container = render([`In fiscal 2023 ${PHRASE} by 4%.`], null);
    select(0, PHRASE);
    expect(readSelectionAnchor(container)).toEqual({ text: PHRASE });
  });

  it('ignores a selection outside the viewer', () => {
    const container = render(PARAGRAPHS);
    const stray = document.createElement('p');
    stray.textContent = PHRASE;
    document.body.appendChild(stray);
    const range = document.createRange();
    range.selectNodeContents(stray);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readSelectionAnchor(container)).toBeNull();
  });

  it('ignores a caret with nothing selected', () => {
    const container = render(PARAGRAPHS);
    select(0, PHRASE);
    window.getSelection()!.collapseToStart();
    expect(readSelectionAnchor(container)).toBeNull();
  });
});

/**
 * An anchor travels in a link and is resolved by findNormalizedMatch against a
 * fresh text extraction, so the two sides have to agree on what occurrence N is.
 */
describe('anchors resolve back to the passage they were read from', () => {
  const pageText = normalizeText(PARAGRAPHS.join(' '));

  it.each([
    [0, 1],
    [1, 2],
    [2, 3]
  ])('selection %i round-trips to occurrence %i', (spanIndex, expected) => {
    const container = render(PARAGRAPHS);
    select(spanIndex, PHRASE);

    const anchor = readSelectionAnchor(container)!;
    expect(anchor.matchIndex).toBe(expected);

    const needle = normalizeText(anchor.text);
    const match = findNormalizedMatch(pageText, needle, anchor.matchIndex);
    expect(countOccurrences(pageText.slice(0, match!.start), needle) + 1).toBe(expected);
  });
});
