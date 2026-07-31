import { useEffect, useRef } from "react";
import { useEditor } from "@/modules/pdf-doc/store";
import type { Annotation, PageItem, Rect } from "@/modules/pdf-doc/types";
import { TextLayer } from "@/modules/pdf-doc/TextLayer";
import { X } from "lucide-react";

type Tool = "select" | "highlight" | "strikethrough" | "note";

interface Props {
  page: PageItem;
  sourceKey: string;
  getBytes: () => Promise<Uint8Array>;
  /** Rendered CSS dims of the underlying page canvas (post-rotation). */
  displayWidth: number;
  displayHeight: number;
  tool: Tool;
}

/**
 * Overlay that hosts:
 *   1. The real pdf.js text layer (for selection-driven annotations).
 *   2. Annotation rendering (highlight/strikethrough rects, notes).
 *   3. A click handler for placing note annotations.
 *
 * Highlight/strikethrough are driven by the real text selection so the
 * annotation lines up with actual glyphs and correctly splits across
 * multiple lines (one rect per line, straight from Range.getClientRects()).
 */
export function AnnotationLayer({
  page,
  sourceKey,
  getBytes,
  displayWidth,
  displayHeight,
  tool,
}: Props) {
  const { addAnnotation, removeAnnotation } = useEditor();
  const layerRef = useRef<HTMLDivElement | null>(null);

  // Convert a display point (0..1) into normalized SOURCE-page coords.
  function displayToSource(nx: number, ny: number, nw = 0, nh = 0): Rect {
    switch (page.rotation) {
      case 0:
        return { x: nx, y: ny, w: nw, h: nh };
      case 90:
        return { x: ny, y: 1 - nx - nw, w: nh, h: nw };
      case 180:
        return { x: 1 - nx - nw, y: 1 - ny - nh, w: nw, h: nh };
      case 270:
        return { x: 1 - ny - nh, y: nx, w: nh, h: nw };
    }
  }

  // Convert a source-normalized point/rect to display normalized (for rendering).
  function sourceToDisplay(sx: number, sy: number, sw = 0, sh = 0): Rect {
    switch (page.rotation) {
      case 0:
        return { x: sx, y: sy, w: sw, h: sh };
      case 90:
        return { x: 1 - sy - sh, y: sx, w: sh, h: sw };
      case 180:
        return { x: 1 - sx - sw, y: 1 - sy - sh, w: sw, h: sh };
      case 270:
        return { x: sy, y: 1 - sx - sw, w: sh, h: sw };
    }
  }

  // Note placement: click to drop a sticky note at that position.
  function onLayerPointerDown(e: React.PointerEvent) {
    if (tool !== "note") return;
    const r = layerRef.current!.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const text = window.prompt("Note text:");
    if (!text) return;
    const src = displayToSource(nx, ny);
    addAnnotation(page.id, {
      id: crypto.randomUUID(),
      type: "note",
      pos: { x: src.x, y: src.y },
      text,
    });
  }

  // Text-selection driven annotations (highlight & strikethrough).
  useEffect(() => {
    if (tool !== "highlight" && tool !== "strikethrough") return;
    const layer = layerRef.current;
    if (!layer) return;

    function commitSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      // Only act on selections anchored inside this page's text layer.
      const anchorEl =
        sel.anchorNode?.nodeType === 1
          ? (sel.anchorNode as Element)
          : sel.anchorNode?.parentElement ?? null;
      if (!anchorEl || !layer!.contains(anchorEl)) return;

      const layerRect = layer!.getBoundingClientRect();
      if (layerRect.width < 1 || layerRect.height < 1) return;

      const rects: Rect[] = [];
      for (let i = 0; i < sel.rangeCount; i++) {
        const range = sel.getRangeAt(i);
        for (const cr of Array.from(range.getClientRects())) {
          if (cr.width < 1 || cr.height < 1) continue;
          const nx = (cr.left - layerRect.left) / layerRect.width;
          const ny = (cr.top - layerRect.top) / layerRect.height;
          const nw = cr.width / layerRect.width;
          const nh = cr.height / layerRect.height;
          // Clip to layer bounds.
          const cx = Math.max(0, Math.min(1, nx));
          const cy = Math.max(0, Math.min(1, ny));
          const cw = Math.max(0, Math.min(1 - cx, nw - (cx - nx)));
          const ch = Math.max(0, Math.min(1 - cy, nh - (cy - ny)));
          if (cw < 0.001 || ch < 0.001) continue;
          rects.push(displayToSource(cx, cy, cw, ch));
        }
      }
      if (rects.length === 0) return;

      const base = { id: crypto.randomUUID(), rects };
      if (tool === "highlight") {
        addAnnotation(page.id, { ...base, type: "highlight", color: "#FFEB3B" });
      } else {
        addAnnotation(page.id, { ...base, type: "strikethrough", color: "#E53935" });
      }
      sel.removeAllRanges();
    }

    // mouseup fires after selection finalizes; defer one tick to be safe.
    function onMouseUp() {
      setTimeout(commitSelection, 0);
    }
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [tool, page.id, page.rotation, addAnnotation]);

  const layerCursor = tool === "note" ? "crosshair" : undefined;

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      style={{ width: displayWidth, height: displayHeight, cursor: layerCursor }}
      onPointerDown={onLayerPointerDown}
    >
      {/* Text layer sits underneath the annotations but above the canvas. */}
      <TextLayer
        sourceKey={sourceKey}
        getBytes={getBytes}
        pageIndex={page.sourceIndex}
        rotation={page.rotation}
        displayWidth={displayWidth}
        displayHeight={displayHeight}
        interactive={tool === "highlight" || tool === "strikethrough"}
      />
      {page.annotations.map((a) => (
        <RenderedAnnotation
          key={a.id}
          annotation={a}
          project={sourceToDisplay}
          onDelete={() => removeAnnotation(page.id, a.id)}
          selectable={tool === "select"}
        />
      ))}
    </div>
  );
}

function RenderedAnnotation({
  annotation,
  project,
  onDelete,
  selectable,
}: {
  annotation: Annotation;
  project: (x: number, y: number, w?: number, h?: number) => Rect;
  onDelete: () => void;
  selectable: boolean;
}) {
  if (annotation.type === "note") {
    const p = project(annotation.pos.x, annotation.pos.y);
    return (
      <div
        className="group absolute"
        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, pointerEvents: "auto" }}
        title={annotation.text}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2 rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-900 shadow ring-1 ring-yellow-500/40">
          Note
          {selectable && (
            <button
              onClick={onDelete}
              className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
              aria-label="Delete note"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute left-3 top-3 max-w-[220px] rounded border border-yellow-500/40 bg-yellow-50 p-2 text-[11px] leading-snug text-yellow-900 opacity-0 shadow group-hover:opacity-100">
          {annotation.text}
        </div>
      </div>
    );
  }

  // highlight or strikethrough — one visual per source rect.
  const rects = annotation.rects;
  if (!rects || rects.length === 0) return null;
  const first = project(rects[0].x, rects[0].y, rects[0].w, rects[0].h);
  return (
    <div className="group pointer-events-none absolute inset-0">
      {rects.map((r, i) => {
        const d = project(r.x, r.y, r.w, r.h);
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${d.x * 100}%`,
          top: `${d.y * 100}%`,
          width: `${d.w * 100}%`,
          height: `${d.h * 100}%`,
        };
        if (annotation.type === "highlight") {
          return (
            <div
              key={i}
              className="rounded-sm"
              style={{ ...style, background: hexA(annotation.color, 0.4) }}
            />
          );
        }
        return (
          <div key={i} style={style}>
            <div
              className="absolute left-0 right-0"
              style={{
                top: "50%",
                height: 2,
                background: annotation.color,
                transform: "translateY(-50%)",
              }}
            />
          </div>
        );
      })}
      {selectable && (
        <button
          onClick={onDelete}
          className="pointer-events-auto absolute hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow group-hover:flex"
          style={{
            left: `calc(${(first.x + first.w) * 100}% - 6px)`,
            top: `calc(${first.y * 100}% - 6px)`,
          }}
          aria-label={annotation.type === "highlight" ? "Delete highlight" : "Delete strikethrough"}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function hexA(hex: string, a: number) {
  const m = hex.replace("#", "");
  const s = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(s, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${a})`;
}
