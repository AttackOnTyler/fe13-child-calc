/**
 * How often the solve's Web Worker posts a loop's progress. A step can take a few ms (on Lunatic+ most runs end early),
 * while the page redraws the headline, the inbox and the Wishlist tab on every reply: posting each one queued far more
 * page work than the page could do, and blocked it for minutes. Paced, the page gets the latest progress a few times a
 * second, and always the last.
 */
export const POST_EVERY_MS = 250;

/**
 * A pacer for one loop's replies: called once per step with whether it's the loop's last, it says whether to post it.
 * The first step and the last are always posted; between them, one at most every `every` ms.
 */
export function pacer(every = POST_EVERY_MS, now: () => number = () => performance.now()): (last: boolean) => boolean {
  let at = -Infinity;
  return (last) => {
    const t = now();
    if (!last && t - at < every) return false;
    at = t;
    return true;
  };
}
