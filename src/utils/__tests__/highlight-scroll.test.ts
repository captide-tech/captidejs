/**
 * @jest-environment jsdom
 */

import { createRectangleHighlight } from '../pdf-highlighting';

const item = (str: string, x: number, y: number) => ({
  str,
  width: str.length * 5,
  height: 10,
  transform: [1, 0, 0, 1, x, y]
});

const PAGE_ITEMS = [item('Total revenue increased by 9%.', 100, 700)];

const fakeViewer = () => {
  const container = document.createElement('div');
  const pageDiv = document.createElement('div');
  container.appendChild(pageDiv);
  document.body.appendChild(container);

  return {
    pagesCount: 1,
    currentPageNumber: 1,
    container,
    getPageView: () => ({
      pdfPage: { getTextContent: async () => ({ items: PAGE_ITEMS }) },
      div: pageDiv,
      viewport: { convertToViewportPoint: (x: number, y: number) => [x, y] }
    })
  };
};

let scrollIntoView: jest.Mock;

beforeEach(() => {
  document.body.innerHTML = '';
  scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe('createRectangleHighlight scrolling', () => {
  it('lands the passage instantly, so a later re-layout cannot strand it', async () => {
    await createRectangleHighlight({
      searchText: 'revenue increased',
      pdfViewerInstance: fakeViewer(),
      targetPage: 1
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('leaves the view where it is when the caller does not own the scroll', async () => {
    await createRectangleHighlight({
      searchText: 'revenue increased',
      pdfViewerInstance: fakeViewer(),
      targetPage: 1,
      shouldNavigateOnMatch: false
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
