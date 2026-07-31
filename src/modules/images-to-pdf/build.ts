import { PDFDocument, degrees } from "pdf-lib";

export type PageSize = "a4" | "letter" | "fit";
export type Orientation = "auto" | "portrait" | "landscape";
export type Margin = "none" | "small" | "normal";

export interface ImageItem {
  id: string;
  file: File;
  url: string;
  name: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface BuildSettings {
  pageSize: PageSize;
  orientation: Orientation;
  margin: Margin;
}

const PT_PER_INCH = 72;
const SIZES_PT: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const MARGIN_PT: Record<Margin, number> = {
  none: 0,
  small: 18,
  normal: 36,
};

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/** Read intrinsic pixel dimensions from an object URL. */
export function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = url;
  });
}

/** Rotate an image into a JPEG blob so PDF embedding respects orientation. */
async function rotateToJpeg(file: File, rotation: number): Promise<{ bytes: Uint8Array; w: number; h: number; kind: "jpg" | "png" }> {
  const isPng = file.type === "image/png";
  if (rotation % 360 === 0 && (file.type === "image/jpeg" || isPng)) {
    const bytes = await fileToBytes(file);
    const url = URL.createObjectURL(file);
    try {
      const dim = await readImageDimensions(url);
      return { bytes, w: dim.width, h: dim.height, kind: isPng ? "png" : "jpg" };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // Rotate via canvas → JPEG (keeps files small)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not decode image"));
      i.src = url;
    });
    const swap = rotation % 180 !== 0;
    const w = swap ? img.naturalHeight : img.naturalWidth;
    const h = swap ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas encode failed"))), "image/jpeg", 0.9),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, w, h, kind: "jpg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Build a real PDF from ordered images using the given settings. */
export async function buildPdfFromImages(images: ImageItem[], settings: BuildSettings): Promise<Uint8Array> {
  if (!images.length) throw new Error("No images to convert");
  const pdf = await PDFDocument.create();
  const margin = MARGIN_PT[settings.margin];

  for (const item of images) {
    const { bytes, w: imgW, h: imgH, kind } = await rotateToJpeg(item.file, item.rotation);
    const embedded = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

    let pageW: number;
    let pageH: number;
    if (settings.pageSize === "fit") {
      // 96 DPI baseline → convert pixels to points
      const ptW = (imgW / 96) * PT_PER_INCH;
      const ptH = (imgH / 96) * PT_PER_INCH;
      pageW = ptW + margin * 2;
      pageH = ptH + margin * 2;
    } else {
      const [a, b] = SIZES_PT[settings.pageSize];
      let landscape: boolean;
      if (settings.orientation === "landscape") landscape = true;
      else if (settings.orientation === "portrait") landscape = false;
      else landscape = imgW > imgH;
      pageW = landscape ? b : a;
      pageH = landscape ? a : b;
    }

    const page = pdf.addPage([pageW, pageH]);
    const availW = Math.max(1, pageW - margin * 2);
    const availH = Math.max(1, pageH - margin * 2);
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    page.drawImage(embedded, { x, y, width: drawW, height: drawH, rotate: degrees(0) });
  }

  return pdf.save();
}
