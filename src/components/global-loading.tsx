"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

// only waits longer than this get the overlay, so quick actions don't flash
const SHOW_AFTER_MS = 250;

const header = (h: HeadersInit | undefined, name: string) => {
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (h as Record<string, string>)[key] : null;
};

/**
 * Full-screen "กำลังโหลด" while the app waits on the server: server actions (save, delete, publish…)
 * and page changes (links, router.push). Both go through fetch, so it is watched in one place;
 * prefetches are ignored. The overlay also stops double taps while a save is running.
 */
export function GlobalLoading() {
  const [busy, setBusy] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      const watched = header(h, "next-action") !== null || (header(h, "rsc") !== null && header(h, "next-router-prefetch") === null);
      if (!watched) return original(input, init);
      setBusy((n) => n + 1);
      try {
        return await original(input, init);
      } finally {
        setBusy((n) => n - 1);
      }
    };
    // a plain HTML form (e.g. a GET filter) reloads the page itself
    const onSubmit = (e: SubmitEvent) => {
      if (!e.defaultPrevented && !(e.target as HTMLFormElement).hasAttribute("data-no-loading")) setShow(true);
    };
    const onPageShow = () => setShow(false);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.fetch = original;
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!busy) return setShow(false);
    const t = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [busy]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink-900/25 backdrop-blur-[1px]" role="alert" aria-busy="true" aria-live="assertive">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-2xl ring-1 ring-slate-200">
        <LoaderCircle className="size-6 animate-spin text-brand-500" />
        <span className="text-base font-medium text-ink-900">กำลังโหลด…</span>
      </div>
    </div>
  );
}
