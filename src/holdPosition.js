// Keeps a button where the person's thumb is while the page around it changes.
//
// When a card is saved the page grows or shrinks (panels close, counters
// update, new rows appear). Browsers that don't anchor the scroll position
// (notably Safari on iPhone) then move the content under the person's finger.
// Call this just before the action, and call the function it returns after the
// page has updated: it scrolls by exactly as much as the button moved.
export function holdPosition(element) {
  const before = element?.getBoundingClientRect?.().top;

  return function release() {
    if (typeof before !== 'number') return;

    // Two frames: one for React to paint the new content, one for layout to settle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!element?.isConnected) return;

        const shift = element.getBoundingClientRect().top - before;

        if (Math.abs(shift) > 1) window.scrollBy({ top: shift, left: 0, behavior: 'instant' });
      });
    });
  };
}

// True on phones and tablets, where focusing a box opens the keyboard and
// scrolls the page away from what the person was just tapping.
export function isTouchDevice() {
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}
