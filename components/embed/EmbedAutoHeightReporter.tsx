'use client';

import { useEffect } from 'react';

export function EmbedAutoHeightReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const postHeight = () => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
      );

      window.parent?.postMessage(
        {
          type: 'embed-timetable-height',
          height,
        },
        '*'
      );
    };

    postHeight();
    const timeoutId = window.setTimeout(postHeight, 250);
    window.addEventListener('load', postHeight);
    window.addEventListener('resize', postHeight);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('load', postHeight);
      window.removeEventListener('resize', postHeight);
    };
  }, []);

  return null;
}
