import { countOccurrences, findNormalizedMatch, normalizeText } from '../text-matching';

describe('normalizeText', () => {
  it('drops the whitespace and punctuation that PDF extraction varies on', () => {
    expect(normalizeText('Net  income\n(loss)')).toBe('netincomeloss');
    expect(normalizeText('“Revenue” of $1,200')).toBe('"revenue"of1,200');
  });
});

describe('findNormalizedMatch', () => {
  const pageText = normalizeText('Total revenue grew. Total revenue grew again. And once more: total revenue grew.');

  it('covers only the matched text', () => {
    const match = findNormalizedMatch(pageText, normalizeText('total revenue'));
    expect(pageText.slice(match!.start, match!.end)).toBe('totalrevenue');
  });

  it('selects the requested occurrence', () => {
    const first = findNormalizedMatch(pageText, normalizeText('total revenue'), 1);
    const third = findNormalizedMatch(pageText, normalizeText('total revenue'), 3);
    expect(third!.start).toBeGreaterThan(first!.start);
    expect(countOccurrences(pageText.slice(0, third!.start), normalizeText('total revenue'))).toBe(2);
  });

  it('returns null when the requested occurrence does not exist', () => {
    expect(findNormalizedMatch(pageText, normalizeText('total revenue'), 4)).toBeNull();
  });

  it('falls back to a prefix when the tail of a long excerpt does not match', () => {
    const excerpt = `${'a'.repeat(120)}${'z'.repeat(120)}`;
    const match = findNormalizedMatch('a'.repeat(150), excerpt);
    expect(match).toEqual({ start: 0, end: 100 });
  });
});
