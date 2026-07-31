/**
 * pdf.js loader — lazily configures the worker for the browser only.
 * All rendering happens client-side. Documents are cached per key so
 * multiple canvases (thumbnails + main viewer) share one parsed PDF.
 */
import type * as PdfjsNs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// pdf.js v6 uses Map.prototype.getOrInsertComputed (Stage 3 proposal).
// Some browsers don't expose it yet — polyfill before importing pdf.js.
if (typeof globalThis !== "undefined" && typeof Map !== "undefined") {
  const proto = Map.prototype as unknown as {
    getOrInsertComputed?: <K, V>(k: K, cb: (k: K) => V) => V;
  };
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function <K, V>(this: Map<K, V>, key: K, cb: (k: K) => V): V {
      if (this.has(key)) return this.get(key)!;
      const v = cb(key);
      this.set(key, v);
      return v;
    };
  }
}

let cached: typeof PdfjsNs | null = null;

export async function loadPdfjs(): Promise<typeof PdfjsNs> {
  if (cached) return cached;
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  cached = pdfjs;
  return pdfjs;
}

const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadDocumentByKey(
  key: string,
  loader: () => Promise<Uint8Array>,
): Promise<PDFDocumentProxy> {
  const existing = docCache.get(key);
  if (existing) return existing;
  const p = (async () => {
    const pdfjs = await loadPdfjs();
    const bytes = await loader();
    // pdf.js transfers the buffer, so pass a copy to keep the source intact.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return pdfjs.getDocument({ data: copy }).promise;
  })();
  docCache.set(key, p);
  p.catch(() => docCache.delete(key));
  return p;
}

export function invalidateDocument(key: string) {
  docCache.delete(key);
}

/** Legacy helper still used by non-editor callers. */
export async function loadDocument(src: string | ArrayBuffer | Uint8Array) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument(
    typeof src === "string"
      ? { url: src }
      : { data: src instanceof Uint8Array ? src : new Uint8Array(src) },
  );
  return task.promise;
}
