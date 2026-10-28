'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    initializeEdenEnglishHomepage?: (root: HTMLElement) => () => void;
    edenEnglishHomepageRuntime?: Promise<void>;
  }
}

function loadRuntime() {
  if (!window.edenEnglishHomepageRuntime) {
    window.edenEnglishHomepageRuntime = new Promise<void>((resolve, reject) => {
      const load = (src: string) => new Promise<void>((done, fail) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => done();
        script.onerror = () => { script.remove(); fail(new Error('Homepage interactions could not load')); };
        document.head.appendChild(script);
      });
      void load('/english/homepage/lenis.min.js').catch(() => undefined)
        .then(() => load('/english/homepage/runtime.js'))
        .then(resolve, error => { window.edenEnglishHomepageRuntime = undefined; reject(error); });
    });
  }
  return window.edenEnglishHomepageRuntime;
}

export function EnglishHomepageRuntime({ html }: { html: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void loadRuntime().then(() => {
      const root = container.current?.querySelector<HTMLElement>('#eden-aeo');
      if (!cancelled && root) dispose = window.initializeEdenEnglishHomepage?.(root);
    }).catch(() => {
      // Keep the server-rendered page useful if a script request fails.
      container.current?.querySelectorAll('.reveal').forEach(element => element.classList.add('in'));
    });
    return () => { cancelled = true; dispose?.(); };
  }, [html]);
  return <div ref={container} dangerouslySetInnerHTML={{ __html: html }} />;
}
