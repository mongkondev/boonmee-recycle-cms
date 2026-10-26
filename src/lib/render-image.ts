import { toJpeg, toPng } from "html-to-image";

/** Rasterise a DOM node at its native size (preview wrappers may scale it with CSS). */
export async function renderNode(node: HTMLElement, opts: { width: number; height: number; pixelRatio?: number; type?: "png" | "jpeg" }) {
  await document.fonts.ready;
  // every <img> must be decoded first, or it comes out blank
  await Promise.all([...node.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
  const common = {
    width: opts.width,
    height: opts.height,
    pixelRatio: opts.pixelRatio ?? 1,
    cacheBust: true,
    style: { transform: "none" },
  };
  const render = () => (opts.type === "jpeg" ? toJpeg(node, { ...common, quality: 0.85, backgroundColor: "#ffffff" }) : toPng(node, common));
  // WebKit paints <img> inside the SVG snapshot only from the second pass on: warm it up first
  if (isWebKit()) await toPng(node, { ...common, pixelRatio: 0.25 }).catch(() => undefined);
  return render();
}

/** Safari, and every browser on iOS (they all run WebKit). */
const isWebKit = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua));
};

export const dataUrlToFile = async (url: string, name: string) => {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type });
};

/**
 * iOS (Safari and Chrome, both WebKit) only allows navigator.share() right inside a tap, so callers
 * must have the files ready beforehand and call this synchronously from the click handler.
 */
export function shareFilesNow(files: File[], title: string) {
  if (navigator.canShare?.({ files })) {
    navigator.share({ files, title }).catch((e: Error) => {
      if (e.name !== "AbortError") files.forEach((f) => downloadUrl(URL.createObjectURL(f), f.name));
    });
  } else {
    files.forEach((f) => downloadUrl(URL.createObjectURL(f), f.name));
  }
}

export function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

const PAPER_MM = { a4: [210, 297], a5: [148, 210] } as const;

/** Portrait PDF from page images (data URLs or same-origin URLs), one image per page. */
export async function imagesToPdf(urls: string[], fileName: string, format: keyof typeof PAPER_MM = "a4") {
  const { jsPDF } = await import("jspdf");
  const [w, h] = PAPER_MM[format];
  const pdf = new jsPDF({ unit: "mm", format });
  for (const [i, url] of urls.entries()) {
    if (i) pdf.addPage(format);
    const data = url.startsWith("data:") ? url : await blobToDataUrl(await (await fetch(url)).blob());
    pdf.addImage(data, "JPEG", 0, 0, w, h, undefined, "FAST");
  }
  pdf.save(fileName);
}

export const imagesToA4Pdf = (urls: string[], fileName: string) => imagesToPdf(urls, fileName, "a4");

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
