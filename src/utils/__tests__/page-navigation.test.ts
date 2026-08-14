import { goToPage } from '../page-navigation';

const viewerOn = (currentPageNumber: number) => ({ currentPageNumber });

describe('goToPage', () => {
  it('leaves the page alone when a citation already sits on it', () => {
    const viewer = viewerOn(1);
    const scrolled = jest.fn();
    Object.defineProperty(viewer, 'currentPageNumber', {
      get: () => 1,
      set: scrolled
    });

    goToPage(viewer, 1, true);

    expect(scrolled).not.toHaveBeenCalled();
  });

  it('still moves a citation on another page onto it', () => {
    const viewer = viewerOn(1);
    goToPage(viewer, 7, true);
    expect(viewer.currentPageNumber).toBe(7);
  });

  it('re-asserts the page without a citation, which is what re-centres it', () => {
    const viewer = viewerOn(1);
    const scrolled = jest.fn();
    Object.defineProperty(viewer, 'currentPageNumber', {
      get: () => 1,
      set: scrolled
    });

    goToPage(viewer, 1, false);

    expect(scrolled).toHaveBeenCalledWith(1);
  });
});
