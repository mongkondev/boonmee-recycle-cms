import { toJpeg, toPng } from "html-to-image";

/** Rasterise a DOM node at its native size (preview wrappers may scale it with CSS). */
export async function renderNode(node: HTMLElement, opts: { width: number; height: number; pixelRatio?: number; type?: "png" | "jpeg" }) {
  await document.fonts.ready;
  const common = {
    width: opts.width,
    height: opts.height,
    pixelRatio: opts.pixelRatio ?? 1,
    cacheBust: true,
    style: { transform: "none" },
  };
  return opts.type === "jpeg" ? toJpeg(node, { ...common, quality: 0.85, backgroundColor: "#ffffff" }) : toPng(node, common);
}

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

/** A4 portrait PDF from page images (data URLs or same-origin URLs). */
export async function imagesToA4Pdf(urls: string[], fileName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  for (const [i, url] of urls.entries()) {
    if (i) pdf.addPage("a4");
    const data = url.startsWith("data:") ? url : await blobToDataUrl(await (await fetch(url)).blob());
    pdf.addImage(data, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  }
  pdf.save(fileName);
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
