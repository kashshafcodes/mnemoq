import { useEffect } from 'react';

// Shows how many cards are due in the browser tab title and, where the device
// supports it, on the app icon. Renders nothing.
export default function DueBadge({ count }) {
  useEffect(() => {
    document.title = count > 0 ? `(${count}) mnemoq` : 'mnemoq';

    try {
      if (count > 0) navigator.setAppBadge?.(count);
      else navigator.clearAppBadge?.();
    } catch {
      // Badges are optional.
    }

    return () => {
      document.title = 'mnemoq';
    };
  }, [count]);

  return null;
}
