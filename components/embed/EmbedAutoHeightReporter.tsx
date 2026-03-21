'use client';

import { useEffect } from 'react';

export function EmbedAutoHeightReporter({
  messageType = 'embed-timetable-height',
}: {
  messageType?: string;
}) {
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
          type: messageType,
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
  }, [messageType]);

  return null;
}
