import { useEffect, useRef } from "react";
import { loadDocumentByKey, loadPdfjs } from "@/modules/pdf-render/loader";

interface Props {
  sourceKey: string;
  getBytes: () => Promise<Uint8Array>;
  pageIndex: number;
  /** Extra rotation applied on top of the source's inherent page rotation. */
  rotation: number;
  displayWidth: number;
  displayHeight: number;
  /** Enables user text selection. Off in Select/Note modes so those tools don't collide. */
  interactive: boolean;
}

/**
 * Overlays the rendered page canvas with pdf.js's real text layer so users
 * can select existing PDF text with the mouse. The AnnotationLayer reads
 * `window.getSelection()` off this to build highlight/strikethrough rects.
 */
export function TextLayer({
  sourceKey,
  getBytes,
  pageIndex,
  rotation,
  displayWidth,
  displayHeight,
  interactive,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !displayWidth || !displayHeight) return;
    const container = containerRef.current;
    let cancelled = false;
    container.innerHTML = "";
    (async () => {
      const pdfjs = await loadPdfjs();
      const doc = await loadDocumentByKey(sourceKey, getBytes);
      const page = await doc.getPage(pageIndex + 1);
      const totalRotation = (((page.rotate ?? 0) + rotation) % 360 + 360) % 360;
      const unscaled = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = displayWidth / unscaled.width;
      const viewport = page.getViewport({ scale, rotation: totalRotation });
      if (cancelled) return;
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      // pdfjs-dist v6 exports the TextLayer class from the main entry.
      const TL = (pdfjs as unknown as { TextLayer: new (o: unknown) => { render(): Promise<void> } })
        .TextLayer;
      const tl = new TL({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      await tl.render();
      if (cancelled) container.innerHTML = "";
    })().catch(() => {
      /* text layer failure is non-fatal — annotations simply can't be created for this page */
    });
    return () => {
      cancelled = true;
    };
  }, [sourceKey, pageIndex, rotation, displayWidth, displayHeight, getBytes]);

  return (
    <div
      ref={containerRef}
      className="textLayer absolute inset-0"
      style={{
        pointerEvents: interactive ? "auto" : "none",
        userSelect: interactive ? "text" : "none",
        cursor: interactive ? "text" : undefined,
      }}
    />
  );
}
