import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadDocumentByKey } from "./loader";
import { Loader2 } from "lucide-react";

interface Props {
  /** Stable id for the underlying PDF bytes. When omitted, `url` is used. */
  sourceKey?: string;
  /** Loader producing the bytes on first use. Required when sourceKey is set. */
  getBytes?: () => Promise<Uint8Array>;
  /** Alternative to sourceKey+getBytes: fetch a remote/blob URL. */
  url?: string;
  pageIndex: number;
  /** Extra rotation (deg CW, multiples of 90) to apply on top of source rotation. */
  rotation?: number;
  /** Rendered CSS width in pixels; height derives from the page aspect. */
  targetWidth?: number;
  onSize?: (dims: { width: number; height: number }) => void;
  onNumPages?: (n: number) => void;
  className?: string;
}

/**
 * Renders one page of a PDF at high DPI onto a canvas. The parsed pdf.js
 * document is cached in loader.ts and shared between viewer + thumbnails.
 */
export function PdfPageCanvas({
  sourceKey,
  getBytes,
  url,
  pageIndex,
  rotation = 0,
  targetWidth,
  onSize,
  onNumPages,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRendered(false);
    const key = sourceKey ?? url;
    if (!key) {
      setError("No PDF source provided");
      return;
    }
    const load = getBytes
      ? () => getBytes()
      : async () => new Uint8Array(await (await fetch(url!)).arrayBuffer());
    loadDocumentByKey(key, load)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        onNumPages?.(d.numPages);
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Failed to load PDF"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, url]);

  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const containerWidth =
        targetWidth ?? wrapperRef.current?.clientWidth ?? canvas.parentElement?.clientWidth ?? 800;
      const totalRotation = (((page.rotate ?? 0) + rotation) % 360 + 360) % 360;
      const unscaled = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = (containerWidth / unscaled.width) * dpr;
      const viewport = page.getViewport({ scale, rotation: totalRotation });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (!cancelled) {
        setRendered(true);
        onSize?.({ width: viewport.width / dpr, height: viewport.height / dpr });
      }
    })().catch((e) => {
      if (!cancelled) setError(e?.message ?? "Render failed");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageIndex, rotation, targetWidth]);

  if (error) return <div className="p-4 text-xs text-destructive">{error}</div>;

  return (
    <div ref={wrapperRef} className={className}>
      {!rendered && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={"mx-auto max-w-full rounded-md " + (rendered ? "block" : "hidden")}
      />
    </div>
  );
}
