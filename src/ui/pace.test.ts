import { describe, expect, it } from 'vitest';
import { POST_EVERY_MS, pacer } from './pace';

/**
 * The worker's replies, paced: a solve step on Lunatic+ can take a few ms, and the page redraws on every reply it gets.
 * The first and the last always go out; between them, one at most every `POST_EVERY_MS`.
 */
describe('the worker’s reply pacer', () => {
  it('posts the first step, drops those within the interval, and posts again once it has passed', () => {
    let now = 1000;
    const post = pacer(POST_EVERY_MS, () => now);
    expect(post(false)).toBe(true);
    now += 30;
    expect(post(false)).toBe(false);
    now += POST_EVERY_MS - 31;
    expect(post(false)).toBe(false);
    now += 1;
    expect(post(false)).toBe(true);
  });

  it('always posts the last step', () => {
    let now = 0;
    const post = pacer(POST_EVERY_MS, () => now);
    expect(post(false)).toBe(true);
    now += 1;
    expect(post(true)).toBe(true);
  });

  it('keeps a 30 s solve of 30 ms steps to a few replies a second', () => {
    let now = 0;
    const post = pacer(POST_EVERY_MS, () => now);
    let posted = 0;
    for (; now < 30_000; now += 30) if (post(now + 30 >= 30_000)) posted++;
    expect(posted).toBeLessThanOrEqual(30_000 / POST_EVERY_MS + 2);
    expect(posted).toBeGreaterThan(30_000 / POST_EVERY_MS / 2);
  });
});
