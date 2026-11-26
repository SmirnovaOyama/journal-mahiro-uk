/* Where the journal lives on this device, and asking for it to be kept.

   Safari clears everything a site stored with script (localStorage,
   IndexedDB) once the site goes unopened for 7 days of Safari use. A site
   added to the Home Screen (or, on a Mac, the Dock) isn't part of Safari:
   it counts its own days. But it starts with storage of its own, which it
   doesn't share with the Safari tab, so a journal kept in the tab has to be
   carried across, by the encrypted sync, before it can live there. */

/** Opened from the Home Screen or the Dock, not in a browser tab. */
export function isInstalled(): boolean {
    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

/** A browser built on WebKit's storage rules: any on an iPhone or iPad, and
 *  Safari on a Mac. These are the ones that clear an unvisited site's data. */
export function clearsUnvisited(): boolean {
    const ua = navigator.userAgent;
    const macSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua);
    return onTouch() || macSafari;
}

/** An iPhone or iPad (which calls itself a Mac, with a touch screen): it
 *  has a Home Screen; a Mac has the Dock. */
export const onTouch = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Ask the browser to keep this site's storage when it's short of room.
 *  Only from the Home Screen: WebKit weighs that in granting it, and some
 *  browsers (Firefox) ask the person in a prompt, which a tab shouldn't
 *  spring on someone who just arrived. */
export function askToKeep() {
    if (!isInstalled()) return;
    navigator.storage?.persist?.().catch(() => {});
}
