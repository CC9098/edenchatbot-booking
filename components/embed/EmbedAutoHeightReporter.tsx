'use client';

import { useEffect } from 'react';

export function EmbedAutoHeightReporter({
  messageType = 'embed-timetable-height',
}: {
  messageType?: string;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    let lastHeight = 0;

    const postHeight = () => {
      frameId = 0;

      const contentBottom = Array.from(document.body.children).reduce((bottom, element) => {
        const rect = element.getBoundingClientRect();
        return Math.max(bottom, rect.bottom + window.scrollY);
      }, 0);
      const height = Math.ceil(contentBottom || document.body.scrollHeight);

      if (height === lastHeight) return;
      lastHeight = height;

      window.parent?.postMessage(
        {
          type: messageType,
          height,
        },
        '*'
      );
    };

    const requestPostHeight = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(postHeight);
    };

    requestPostHeight();

    const timeoutIds = [160, 400, 900, 1800].map((delay) =>
      window.setTimeout(requestPostHeight, delay)
    );
    const intervalId = window.setInterval(requestPostHeight, 1500);
    const resizeObserver = new ResizeObserver(requestPostHeight);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(requestPostHeight);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const images = Array.from(document.images);
    images.forEach((image) => {
      image.addEventListener('load', requestPostHeight);
      image.addEventListener('error', requestPostHeight);
    });

    window.addEventListener('load', requestPostHeight);
    window.addEventListener('resize', requestPostHeight);
    window.addEventListener('pageshow', requestPostHeight);
    window.addEventListener('transitionend', requestPostHeight);
    window.addEventListener('animationend', requestPostHeight);
    window.visualViewport?.addEventListener('resize', requestPostHeight);
    window.visualViewport?.addEventListener('scroll', requestPostHeight);
    document.fonts?.ready.then(requestPostHeight).catch(() => {});

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.clearInterval(intervalId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      images.forEach((image) => {
        image.removeEventListener('load', requestPostHeight);
        image.removeEventListener('error', requestPostHeight);
      });
      window.removeEventListener('load', requestPostHeight);
      window.removeEventListener('resize', requestPostHeight);
      window.removeEventListener('pageshow', requestPostHeight);
      window.removeEventListener('transitionend', requestPostHeight);
      window.removeEventListener('animationend', requestPostHeight);
      window.visualViewport?.removeEventListener('resize', requestPostHeight);
      window.visualViewport?.removeEventListener('scroll', requestPostHeight);
    };
  }, [messageType]);

  return null;
}
