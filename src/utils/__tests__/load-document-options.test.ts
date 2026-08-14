import { normalizeLoadDocumentArgs } from '../load-document-options';

describe('normalizeLoadDocumentArgs', () => {
  it('reads the published positional call', () => {
    expect(normalizeLoadDocumentArgs(12, 'net revenue')).toEqual({
      page: 12,
      snippet: 'net revenue',
      matchIndex: undefined
    });
  });

  it('reads the options call, including the occurrence index', () => {
    expect(
      normalizeLoadDocumentArgs({ page: 12, snippet: 'net revenue', matchIndex: 3 })
    ).toEqual({ page: 12, snippet: 'net revenue', matchIndex: 3 });
  });

  it('carries nothing for a bare call', () => {
    expect(normalizeLoadDocumentArgs()).toEqual({
      page: undefined,
      snippet: undefined,
      matchIndex: undefined
    });
  });

  it('derives a one-based page from a legacy element id', () => {
    expect(normalizeLoadDocumentArgs(undefined, undefined, 'element-0011').page).toBe(12);
    expect(normalizeLoadDocumentArgs({ legacyElementId: 'element-0011' }).page).toBe(12);
  });

  it('prefers an explicit page over a legacy element id', () => {
    expect(normalizeLoadDocumentArgs(4, undefined, 'element-0011').page).toBe(4);
  });

  it('ignores a legacy element id with no page in it', () => {
    expect(normalizeLoadDocumentArgs(undefined, undefined, 'header').page).toBeUndefined();
  });
});
