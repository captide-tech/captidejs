/**
 * Text matching for citation highlights.
 *
 * PDF text extraction splits words across items and varies in whitespace and
 * punctuation, so matching runs on a normalized form. Offsets returned here are
 * indices into that normalized text, never into the original string.
 */

/** Tried in order when the full text finds nothing, longest first. */
const SEARCH_PREFIX_LENGTHS = [200, 100, 50];

export interface NormalizedMatch {
  start: number;
  end: number;
}

export const normalizeText = (str: string): string => {
  return str
    .toLowerCase()
    // normalize curly/typographic double quotes to ASCII "
    .replace(/[“”„‟«»‹›＂]/g, '"')
    // remove whitespace, $, apostrophes, parentheses/brackets
    .replace(/[\s$'’‘‚‛´ʻʼʽʾʿˈˊˋ˴՚ꞌ＇()\[\]{}⟨⟩‹›«»「」『』【】〔〕〈〉《》❨❩❪❫❬❭]+/g, '');
};

/**
 * Locates the `occurrence`-th (1-based) match of `normalizedSearchText`, falling
 * back to shorter prefixes so a long excerpt still lands when layout variance
 * breaks its tail. The returned range covers only what actually matched.
 */
export const findNormalizedMatch = (
  normalizedPageText: string,
  normalizedSearchText: string,
  occurrence: number = 1
): NormalizedMatch | null => {
  if (!normalizedPageText || !normalizedSearchText) return null;

  const requested = Number.isFinite(occurrence) ? Math.max(1, occurrence) : 1;
  const match = matchAtOccurrence(normalizedPageText, normalizedSearchText, requested);
  if (match || requested === 1) return match;

  // An occurrence index travels in a link and is resolved against a fresh text
  // extraction, so a stale or off-by-one one must not lose the highlight.
  return matchAtOccurrence(normalizedPageText, normalizedSearchText, 1);
};

/** How many complete occurrences of `normalizedSearchText` precede the text in `normalizedPrefix`. */
export const countOccurrences = (
  normalizedPrefix: string,
  normalizedSearchText: string
): number => {
  if (!normalizedPrefix || !normalizedSearchText) return 0;

  let count = 0;
  let index = normalizedPrefix.indexOf(normalizedSearchText);
  while (index !== -1) {
    count += 1;
    index = normalizedPrefix.indexOf(normalizedSearchText, index + 1);
  }
  return count;
};

const matchAtOccurrence = (
  normalizedPageText: string,
  normalizedSearchText: string,
  occurrence: number
): NormalizedMatch | null => {
  for (const candidate of searchCandidates(normalizedSearchText)) {
    const start = nthIndexOf(normalizedPageText, candidate, occurrence);
    if (start !== -1) {
      return { start, end: start + candidate.length };
    }
  }
  return null;
};

const searchCandidates = (normalizedSearchText: string): string[] => {
  const candidates = [normalizedSearchText];
  for (const length of SEARCH_PREFIX_LENGTHS) {
    if (normalizedSearchText.length > length) {
      candidates.push(normalizedSearchText.slice(0, length));
    }
  }
  return candidates;
};

const nthIndexOf = (haystack: string, needle: string, occurrence: number): number => {
  let index = -1;
  for (let found = 0; found < occurrence; found += 1) {
    index = haystack.indexOf(needle, index + 1);
    if (index === -1) return -1;
  }
  return index;
};
