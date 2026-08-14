import type { LoadDocumentOptions } from '../types';

export interface NormalizedLoadDocument {
  page?: number;
  snippet?: string;
  matchIndex?: number;
}

/**
 * Accepts both `loadDocument` call shapes: the published positional one and the
 * options object that carries `matchIndex`.
 */
export const normalizeLoadDocumentArgs = (
  pageNumberOrOptions?: number | LoadDocumentOptions,
  citationSnippet?: string,
  legacyElementId?: string
): NormalizedLoadDocument => {
  const options: LoadDocumentOptions =
    typeof pageNumberOrOptions === 'object' && pageNumberOrOptions !== null
      ? pageNumberOrOptions
      : { page: pageNumberOrOptions, snippet: citationSnippet, legacyElementId };

  return {
    page: options.page || pageFromLegacyElementId(options.legacyElementId),
    snippet: options.snippet,
    matchIndex: options.matchIndex
  };
};

/** Legacy element ids ended with a 0-based page index in their last four characters. */
const pageFromLegacyElementId = (legacyElementId?: string): number | undefined => {
  if (!legacyElementId) return undefined;
  const pageIndex = parseInt(legacyElementId.slice(-4), 10);
  return isNaN(pageIndex) ? undefined : pageIndex + 1;
};
