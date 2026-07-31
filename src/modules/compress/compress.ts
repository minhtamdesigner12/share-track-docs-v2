import { PDFDocument } from "pdf-lib";
import { loadPdfjs } from "@/modules/pdf-render/loader";

export type CompressLevel = "recommended" | "maximum";

export interface CompressProfile {
  dpi: number;
  quality: number;
  label: string;
}

export const PROFILES: Record<CompressLevel, CompressProfile> = {
  recommended: { dpi: 144, quality: 0.72, label: "Recommended" },
  maximum: { dpi: 110, quality: 0.5, label: "Maximum compression" },
};

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  /** true when compressed is not meaningfully smaller than original */
  notSmaller: boolean;
}

export interface CompressProgress {
  page: number;
  total: number;
}

/**
 * Real PDF compression by re-rasterizing each page to a JPEG at the profile's
 * DPI/quality and rebuilding a fresh PDF. This is the same approach used by
 * most desktop "reduce file size" features and gives real, verifiable savings
 * on image-heavy PDFs.
 *
 * Trade-off: pure vector/text PDFs may not shrink (and may grow); the caller
 * surfaces `notSmaller` so we never advertise fake savings.
 */
export async function compressPdf(
  bytes: Uint8Array,
  level: CompressLevel,
  onProgress?: (p: CompressProgress) => void,
): Promise<CompressResult> {
  const profile = PROFILES[level];
  const pdfjs = await loadPdfjs();

  // pdf.js transfers the buffer — keep a copy.
  const forRender = new Uint8Array(bytes.byteLength);
  forRender.set(bytes);
  const src = await pdfjs.getDocument({ data: forRender }).promise;

  const out = await PDFDocument.create();
  const scale = profile.dpi / 72; // PDF points are 72 DPI

  for (let i = 1; i <= src.numPages; i++) {
    const page = await src.getPage(i);
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error("Failed to encode page image"))),
        "image/jpeg",
        profile.quality,
      ),
    );
    const jpgBytes = new Uint8Array(await blob.arrayBuffer());
    const img = await out.embedJpg(jpgBytes);

    // Preserve original page geometry (in PDF points) so the page reads at
    // the same physical size as the source.
    const originalViewport = page.getViewport({ scale: 1 });
    const pageW = originalViewport.width;
    const pageH = originalViewport.height;
    const pdfPage = out.addPage([pageW, pageH]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });

    page.cleanup();
    onProgress?.({ page: i, total: src.numPages });
  }

  const compressed = await out.save({ useObjectStreams: true });
  const compressedSize = compressed.byteLength;
  const originalSize = bytes.byteLength;
  // If we saved less than ~3% we consider it "not smaller".
  const notSmaller = compressedSize >= originalSize * 0.97;

  return {
    bytes: compressed,
    originalSize,
    compressedSize,
    pageCount: src.numPages,
    notSmaller,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
