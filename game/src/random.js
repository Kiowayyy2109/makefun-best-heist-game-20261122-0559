// Seeded random numbers (mulberry32) so a ?seed= value replays the same
// room variation: loot values jitter, patrol speeds jitter, sparkle phases.
// Nothing here touches the DOM, so the logic tests can import it in Node.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Integer in [min, max]. */
    int(min, max) {
      if (max < min) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** One element, or undefined for an empty list (never throws). */
    pick(list) {
      if (!list || list.length === 0) return undefined;
      return list[Math.floor(next() * list.length)];
    },
  };
}

/** Small deterministic hash of a string, for naming a seed from a word. */
export function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
