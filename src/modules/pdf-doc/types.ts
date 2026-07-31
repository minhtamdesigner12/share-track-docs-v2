/**
 * Types for the in-memory PDF document being edited.
 * The original uploaded bytes are never mutated — export builds a new PDF.
 */

export type SourceId = string;
export type PageId = string;

export interface PdfSource {
  id: SourceId;
  name: string;
  bytes: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Highlight/strikethrough annotations store one or more rectangles
 * in normalized SOURCE-page coords (0..1, top-left origin, rotation=0).
 * Multiple rects support multi-line text selections — one rect per line.
 */
export interface HighlightAnnotation {
  id: string;
  type: "highlight";
  rects: Rect[];
  color: string;
}
export interface StrikethroughAnnotation {
  id: string;
  type: "strikethrough";
  rects: Rect[];
  color: string;
}
export interface NoteAnnotation {
  id: string;
  type: "note";
  pos: { x: number; y: number };
  text: string;
}
export type Annotation = HighlightAnnotation | StrikethroughAnnotation | NoteAnnotation;

export type Rotation = 0 | 90 | 180 | 270;

export interface PageItem {
  id: PageId;
  sourceId: SourceId;
  sourceIndex: number; // 0-based
  rotation: Rotation;
  annotations: Annotation[];
}

export interface DocState {
  sources: Record<SourceId, PdfSource>;
  pages: PageItem[];
}

export type EditorTool = "select" | "highlight" | "strikethrough" | "note";
