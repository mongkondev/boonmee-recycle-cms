"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { ShopSettings } from "./types";
import { useImageDataUrl } from "./use-image-data-url";

/**
 * LINE QR for menus: the uploaded QR image when there is one, otherwise generated from the LINE link.
 * `ready` turns true once there is nothing left to wait for (so renders don't miss the QR).
 */
export function useLineQr(settings: Pick<ShopSettings, "line_url"> & Partial<Pick<ShopSettings, "line_qr_image">>, width: number) {
  const uploadedImg = useImageDataUrl(settings.line_qr_image);
  const uploaded = settings.line_qr_image || null;
  const [generated, setGenerated] = useState<{ url: string; qr: string } | null>(null);
  const url = settings.line_url;

  useEffect(() => {
    if (uploaded || !url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 0, width, color: { dark: "#003020" } }).then((qr) => !cancelled && setGenerated({ url, qr }));
    return () => {
      cancelled = true;
    };
  }, [uploaded, url, width]);

  if (uploaded) return { qr: uploadedImg.url, ready: uploadedImg.ready };
  if (!url) return { qr: null, ready: true };
  const qr = generated?.url === url ? generated.qr : null;
  return { qr, ready: qr !== null };
}
