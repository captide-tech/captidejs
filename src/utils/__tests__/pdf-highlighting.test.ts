import { findTextInPDF } from '../pdf-highlighting';

const item = (str: string, x: number, y: number) => ({
  str,
  width: str.length * 5,
  height: 10,
  transform: [1, 0, 0, 1, x, y]
});

const fakeViewer = (pages: any[][]) => ({
  pagesCount: pages.length,
  currentPageNumber: 1,
  getPageView: (index: number) => ({
    pdfPage: { getTextContent: async () => ({ items: pages[index] }) },
    div: null,
    viewport: null
  })
});

describe('findTextInPDF', () => {
  const viewer = fakeViewer([
    [
      item('Total revenue for the ', 100, 700),
      item('quarter increased by 15%. ', 100, 680),
      item('Total revenue for the ', 100, 660),
      item('year was flat.', 100, 640)
    ],
    [item('Continued on the next page.', 100, 700)]
  ]);

  it('maps the match onto the items it covers, clipped by fraction', async () => {
    const result = await findTextInPDF('revenue for the quarter', viewer, { targetPage: 1 });
    expect(result!.pages).toHaveLength(1);
    expect(result!.pages[0].items.map(i => i.item.str)).toEqual([
      'Total revenue for the ',
      'quarter increased by 15%. '
    ]);
    expect(result!.pages[0].items[0].startFraction).toBeGreaterThan(0);
    expect(result!.pages[0].items[0].endFraction).toBe(1);
    expect(result!.pages[0].items[1].startFraction).toBe(0);
    expect(result!.pages[0].items[1].endFraction).toBeLessThan(1);
  });

  it('honours the occurrence index', async () => {
    const first = await findTextInPDF('Total revenue for the', viewer, { targetPage: 1, matchIndex: 1 });
    const second = await findTextInPDF('Total revenue for the', viewer, { targetPage: 1, matchIndex: 2 });
    expect(first!.pages[0].items.map(i => i.item.transform[5])).toEqual([700]);
    expect(second!.pages[0].items.map(i => i.item.transform[5])).toEqual([660]);
  });

  it('falls back to the first occurrence when the requested one is gone', async () => {
    const result = await findTextInPDF('Total revenue for the', viewer, { targetPage: 1, matchIndex: 9 });
    expect(result!.pages[0].items.map(i => i.item.transform[5])).toEqual([700]);
  });

  it('splits a match that straddles a page break', async () => {
    const straddling = 'year was flat. Continued on the next';
    const result = await findTextInPDF(straddling, viewer, { targetPage: 1 });
    expect(result!.pages.map(p => p.page)).toEqual([1, 2]);
    expect(result!.pages[1].items[0].endFraction).toBeLessThan(1);

    expect(await findTextInPDF(straddling, viewer)).toBeNull();
  });
});
