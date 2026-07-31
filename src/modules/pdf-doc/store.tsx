import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import type { Annotation, DocState, PageItem, PdfSource, Rotation } from "./types";

/**
 * Central editor store: sources + pages + annotations, plus an undo/redo stack.
 * All mutations go through the reducer so undo can snapshot cleanly.
 */

type Action =
  | { type: "load"; state: DocState }
  | { type: "addSource"; source: PdfSource; pages: PageItem[] }
  | { type: "reorder"; pageIds: string[] }
  | { type: "removePage"; pageId: string }
  | { type: "rotatePage"; pageId: string; delta: 90 | -90 | 180 }
  | { type: "addAnnotation"; pageId: string; annotation: Annotation }
  | { type: "removeAnnotation"; pageId: string; annotationId: string };

function reducer(state: DocState, action: Action): DocState {
  switch (action.type) {
    case "load":
      return action.state;
    case "addSource":
      return {
        sources: { ...state.sources, [action.source.id]: action.source },
        pages: [...state.pages, ...action.pages],
      };
    case "reorder": {
      const byId = new Map(state.pages.map((p) => [p.id, p]));
      return { ...state, pages: action.pageIds.map((id) => byId.get(id)!).filter(Boolean) };
    }
    case "removePage":
      return { ...state, pages: state.pages.filter((p) => p.id !== action.pageId) };
    case "rotatePage":
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === action.pageId
            ? { ...p, rotation: (((p.rotation + action.delta) % 360) + 360) % 360 as Rotation }
            : p,
        ),
      };
    case "addAnnotation":
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === action.pageId ? { ...p, annotations: [...p.annotations, action.annotation] } : p,
        ),
      };
    case "removeAnnotation":
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === action.pageId
            ? { ...p, annotations: p.annotations.filter((a) => a.id !== action.annotationId) }
            : p,
        ),
      };
    default:
      return state;
  }
}

interface HistState {
  past: DocState[];
  present: DocState;
  future: DocState[];
}

type HistAction = Action | { type: "undo" } | { type: "redo" };

function histReducer(state: HistState, action: HistAction): HistState {
  if (action.type === "undo") {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: prev,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return { past: [...state.past, state.present], present: next, future: rest };
  }
  const next = reducer(state.present, action);
  if (next === state.present) return state;
  // "load" replaces history entirely; other actions push onto past.
  if (action.type === "load") return { past: [], present: next, future: [] };
  const past = [...state.past, state.present].slice(-50);
  return { past, present: next, future: [] };
}

interface EditorApi {
  state: DocState;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  loadInitialSource: (source: PdfSource, pageCount: number) => void;
  addSource: (source: PdfSource, pageCount: number) => void;
  reorderPages: (pageIds: string[]) => void;
  removePage: (pageId: string) => void;
  rotatePage: (pageId: string, delta: 90 | -90 | 180) => void;
  addAnnotation: (pageId: string, annotation: Annotation) => void;
  removeAnnotation: (pageId: string, annotationId: string) => void;
}

const EditorContext = createContext<EditorApi | null>(null);

const empty: DocState = { sources: {}, pages: [] };

function buildPageItems(source: PdfSource, pageCount: number): PageItem[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceIndex: i,
    rotation: 0 as Rotation,
    annotations: [],
  }));
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [hist, dispatch] = useReducer(histReducer, {
    past: [],
    present: empty,
    future: [],
  });
  const loadedRef = useRef(false);

  const loadInitialSource = useCallback((source: PdfSource, pageCount: number) => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    dispatch({
      type: "load",
      state: { sources: { [source.id]: source }, pages: buildPageItems(source, pageCount) },
    });
  }, []);

  const api = useMemo<EditorApi>(
    () => ({
      state: hist.present,
      canUndo: hist.past.length > 0,
      canRedo: hist.future.length > 0,
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      loadInitialSource,
      addSource: (source, pageCount) =>
        dispatch({ type: "addSource", source, pages: buildPageItems(source, pageCount) }),
      reorderPages: (pageIds) => dispatch({ type: "reorder", pageIds }),
      removePage: (pageId) => dispatch({ type: "removePage", pageId }),
      rotatePage: (pageId, delta) => dispatch({ type: "rotatePage", pageId, delta }),
      addAnnotation: (pageId, annotation) => dispatch({ type: "addAnnotation", pageId, annotation }),
      removeAnnotation: (pageId, annotationId) =>
        dispatch({ type: "removeAnnotation", pageId, annotationId }),
    }),
    [hist, loadInitialSource],
  );

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>");
  return ctx;
}
