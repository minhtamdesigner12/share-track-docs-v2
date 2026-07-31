import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import type { Annotation, DocState, Rotation } from "./types";

/** Transform a rect in normalized SOURCE coords → PDF coords for that source page. */
function sourceRectToPdf(
  rect: { x: number; y: number; w: number; h: number },
  pageW: number,
  pageH: number,
) {
  const x = rect.x * pageW;
  const y = pageH - (rect.y + rect.h) * pageH;
  const w = rect.w * pageW;
  const h = rect.h * pageH;
  return { x, y, w, h };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const int = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

async function drawAnnotations(
  pdfPage: import("pdf-lib").PDFPage,
  annotations: Annotation[],
  font: import("pdf-lib").PDFFont,
) {
  const pageW = pdfPage.getWidth();
  const pageH = pdfPage.getHeight();
  for (const ann of annotations) {
    if (ann.type === "highlight") {
      const c = hexToRgb(ann.color || "#FFEB3B");
      for (const rect of ann.rects) {
        const r = sourceRectToPdf(rect, pageW, pageH);
        pdfPage.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          color: rgb(c.r, c.g, c.b),
          opacity: 0.4,
          borderWidth: 0,
        });
      }
    } else if (ann.type === "strikethrough") {
      const c = hexToRgb(ann.color || "#E53935");
      for (const rect of ann.rects) {
        const r = sourceRectToPdf(rect, pageW, pageH);
        const y = r.y + r.h / 2;
        pdfPage.drawLine({
          start: { x: r.x, y },
          end: { x: r.x + r.w, y },
          thickness: Math.max(1.2, r.h * 0.08),
          color: rgb(c.r, c.g, c.b),
          opacity: 0.9,
        });
      }
    } else if (ann.type === "note") {
      const x = ann.pos.x * pageW;
      const y = pageH - ann.pos.y * pageH;
      const boxW = Math.min(220, pageW - x - 8);
      const lineHeight = 12;
      const padding = 6;
      const words = ann.text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, 10) < boxW - padding * 2) line = test;
        else {
          if (line) lines.push(line);
          line = w;
        }
      }
      if (line) lines.push(line);
      const boxH = lines.length * lineHeight + padding * 2;
      pdfPage.drawRectangle({
        x,
        y: y - boxH,
        width: boxW,
        height: boxH,
        color: rgb(1, 0.95, 0.6),
        borderColor: rgb(0.8, 0.7, 0.2),
        borderWidth: 0.8,
        opacity: 0.95,
      });
      lines.forEach((ln, i) => {
        pdfPage.drawText(ln, {
          x: x + padding,
          y: y - padding - lineHeight * (i + 1) + 3,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      });
    }
  }
}

/** Build a fresh PDF from the current editor state. */
export async function exportPdf(state: DocState): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);

  // Cache one PDFDocument per source
  const sourceDocs = new Map<string, import("pdf-lib").PDFDocument>();
  for (const src of Object.values(state.sources)) {
    // pdf-lib mutates the passed buffer's internals, so give it a copy.
    const copy = new Uint8Array(src.bytes.byteLength);
    copy.set(src.bytes);
    sourceDocs.set(src.id, await PDFDocument.load(copy, { ignoreEncryption: true }));
  }

  for (const item of state.pages) {
    const srcDoc = sourceDocs.get(item.sourceId);
    if (!srcDoc) continue;
    const [copied] = await out.copyPages(srcDoc, [item.sourceIndex]);
    const baseRotation = copied.getRotation().angle;
    const finalRotation = (baseRotation + item.rotation) % 360;
    // Draw annotations in the un-rotated source coord system, then apply the
    // final rotation so viewers see the intended orientation.
    copied.setRotation(degrees(0));
    await drawAnnotations(copied, item.annotations, font);
    copied.setRotation(degrees(finalRotation));
    out.addPage(copied);
  }

  return await out.save();
}

/** Convenience: trigger a browser download for the exported bytes. */
export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Silence unused import warnings when types shift
export type _Rotation = Rotation;
