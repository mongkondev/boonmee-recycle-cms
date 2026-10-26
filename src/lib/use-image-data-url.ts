"use client";

import { useEffect, useState } from "react";

/**
 * Stored image as a data URL. Rendering a DOM node to JPEG (html-to-image) re-fetches <img> URLs,
 * which WebKit (Safari / Chrome on iOS) blocks; data URLs are embedded as they are. Re-encoded as PNG:
 * WebKit leaves JPEG data URLs out of those snapshots.
 * `ready` is true once there is nothing left to wait for.
 */
export function useImageDataUrl(imageId: string | null | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!imageId) return;
    let cancelled = false;
    fetch(`/api/images/${imageId}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(toPngDataUrl)
      .then((url) => !cancelled && setLoaded({ id: imageId, url }))
      .catch(() => !cancelled && setLoaded({ id: imageId, url: null }));
    return () => {
      cancelled = true;
    };
  }, [imageId]);
  if (!imageId) return { url: null, ready: true };
  return loaded?.id === imageId ? { url: loaded.url, ready: true } : { url: null, ready: false };
}

async function toPngDataUrl(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  // documents show these small (≤ 200px at print size); big embedded images are also dropped by WebKit
  const scale = Math.min(1, 300 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
