// Shop grid ordering — keeps cards of the same style apart.
//
// With one card per colour, a bag in five colours would otherwise sit in a row of five.
// spaceOutStyles() re-orders a list (after any sort) so that:
//   • HARD RULE: two cards of the same style are never next to each other, unless that
//     style is all that's left to place (e.g. a page showing a single style).
//   • BEST EFFORT: same-style cards sit at least `targetGap` positions apart. The grid is
//     2 columns on mobile and 4 on desktop, so 5 apart means they don't touch sideways
//     or directly above/below on either layout. On small lists with few styles the gap
//     shrinks step by step (5 → 4 → 3 → 2).
// It always takes the earliest card that qualifies, so the incoming order (price sort,
// curated order, category mix) is disturbed as little as possible.
//
// Works in the browser (window.spaceOutStyles) and in Node (require) for the test script.
(function (root) {
  function styleKey(card) { return card.style_key || card.id; }

  function spaceOutStyles(list, targetGap) {
    targetGap = targetGap || 5;
    if (!Array.isArray(list) || list.length < 3) return list;

    const counts = new Map();
    list.forEach(c => counts.set(styleKey(c), (counts.get(styleKey(c)) || 0) + 1));
    if (counts.size === list.length) return list; // every card is a different style

    const remaining = list.slice();
    const out = [];
    const lastPos = new Map(); // style → index it was last placed at

    while (remaining.length) {
      const n = remaining.length;
      const prev = out.length ? styleKey(out[out.length - 1]) : null;
      let pick = -1;

      // A style holding more than half of what's left must go now, or two of its cards
      // would be forced together later. (Checking this every step is what guarantees
      // the hard rule whenever an arrangement exists at all.)
      let urgent = null;
      counts.forEach((c, k) => { if (c * 2 > n) urgent = k; });
      if (urgent !== null && urgent !== prev) {
        pick = remaining.findIndex(c => styleKey(c) === urgent);
      }

      // Otherwise: earliest card whose style is far enough from its last appearance
      for (let gap = targetGap; gap >= 2 && pick === -1; gap--) {
        pick = remaining.findIndex(c => {
          const last = lastPos.get(styleKey(c));
          return last === undefined || out.length - last >= gap;
        });
      }
      if (pick === -1) pick = 0; // only the previous card's style is left

      const card = remaining.splice(pick, 1)[0];
      const key = styleKey(card);
      lastPos.set(key, out.length);
      counts.set(key, counts.get(key) - 1);
      if (!counts.get(key)) counts.delete(key);
      out.push(card);
    }
    return out;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { spaceOutStyles };
  else root.spaceOutStyles = spaceOutStyles;
})(typeof window !== 'undefined' ? window : this);
