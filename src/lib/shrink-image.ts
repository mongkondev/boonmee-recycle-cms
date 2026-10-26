/**
 * Phone photos are several MB: scale down to `max` px on the long side before upload.
 * PNG stays PNG (keeps a logo's transparency); everything else becomes JPEG.
 */
export async function shrinkImage(file: File, max = 1600): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, 0.85));
  return new File([blob], type === "image/png" ? "image.png" : "image.jpg", { type });
}
