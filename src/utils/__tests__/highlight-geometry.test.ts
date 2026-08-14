import { buildLineRects } from '../pdf-highlighting';

const matched = (str: string, x: number, y: number, startFraction = 0, endFraction = 1) => ({
  item: { str, width: str.length * 5, height: 10, transform: [1, 0, 0, 1, x, y] },
  startFraction,
  endFraction
});

/** PDF space counts upwards from the bottom of the page; viewport space downwards. */
const viewport = { convertToViewportPoint: (x: number, y: number) => [x, 800 - y] };

describe('buildLineRects', () => {
  it('paints one rect per line rather than one box over all of them', () => {
    const rects = buildLineRects(
      [matched('first line', 100, 700), matched('second line', 100, 680)],
      viewport
    );
    expect(rects).toHaveLength(2);
  });

  it('merges items whose baselines differ by less than their height', () => {
    const rects = buildLineRects([matched('left', 100, 700), matched('right', 160, 702)], viewport);
    expect(rects).toHaveLength(1);
    expect(rects[0].left).toBe(100);
    expect(rects[0].width).toBe(85);
  });

  it('clips the ends of the match to the characters it covers', () => {
    const [rect] = buildLineRects([matched('0123456789', 100, 700, 0.5, 0.9)], viewport);
    expect(rect.left).toBe(125);
    expect(rect.width).toBeCloseTo(20);
    expect(rect.top).toBe(90);
    expect(rect.height).toBe(10);
  });

  it('drops items that carry no usable geometry', () => {
    expect(buildLineRects([{ item: { str: 'x' }, startFraction: 0, endFraction: 1 }], viewport)).toEqual([]);
  });
});
