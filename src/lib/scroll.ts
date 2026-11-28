/** Back to the top of the page, gliding there unless the reader asks for
 *  less motion. The page scrolls in App's `.main-view`, not the window. */
export function toPageTop() {
    const page = document.querySelector<HTMLElement>('.main-view');
    if (!page) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    page.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
}
