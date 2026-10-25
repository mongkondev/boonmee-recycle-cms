"use client";

import { useEffect, useState } from "react";

/** Poster preview width that never exceeds the viewport on phones (minus page gutters). */
export function usePreviewWidth(max: number, gutter = 40) {
  const [w, setW] = useState(max);
  useEffect(() => {
    const update = () => setW(Math.min(max, window.innerWidth - gutter));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [max, gutter]);
  return w;
}
