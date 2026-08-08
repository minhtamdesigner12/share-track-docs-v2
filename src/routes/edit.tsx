import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus,
  Highlighter,
  Loader2,
  MousePointer2,
  Redo2,
  RotateCw,
  Share2,
  StickyNote,
  Strikethrough,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { getGuestPdf, putGuestPdf } from "@/lib/guest-pdf-store";
import { PdfPageCanvas } from "@/modules/pdf-render/PdfPageCanvas";
import { loadDocumentByKey } from "@/modules/pdf-render/loader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EditorProvider, useEditor } from "@/modules/pdf-doc/store";
import { AnnotationLayer } from "@/modules/pdf-doc/AnnotationLayer";
import { downloadBytes, exportPdf } from "@/modules/pdf-doc/export";
import type { EditorTool, PdfSource } from "@/modules/pdf-doc/types";
import { ShareTrackDialog } from "@/components/share-track-dialog";

const searchSchema = z.object({ id: z.string().min(1) });

export const Route = createFileRoute("/edit")({
  validateSearch: searchSchema,
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof getGuestPdf>> | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    getGuestPdf(id).then((e) => {
      if (!cancelled) setEntry(e ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (entry === null) navigate({ to: "/", replace: true });
  }, [entry, navigate]);

  // Still loading from IndexedDB — avoid a flash redirect to home while we
  // check, since the file may well still be there (e.g. right after the
  // Google sign-in redirect).
  if (entry === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your PDF…
      </div>
    );
  }
  if (!entry) return null;

  return (
    <EditorProvider>
      <EditorShell docName={entry.name} initialSource={{ id: entry.id, name: entry.name, bytes: entry.bytes }} />
    </EditorProvider>
  );
}

function EditorShell({
  docName,
  initialSource,
}: {
  docName: string;
  initialSource: PdfSource;
}) {
  const navigate = useNavigate();
  const { state, loadInitialSource, addSource, undo, redo, canUndo, canRedo, removePage, rotatePage } =
    useEditor();
 const [tool, setTool] = useState<EditorTool>("select");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldOpen = sessionStorage.getItem("openShareDialog");

    if (shouldOpen) {
      sessionStorage.removeItem("openShareDialog");

      requestAnimationFrame(() => {
        setShareOpen(true);
      });
    }
  }, []);

  const addPagesInputRef = useRef<HTMLInputElement | null>(null);

  const getExportedBytes = useCallback(async () => {
    return await exportPdf(state);
  }, [state]);

  // Load the initial source once
  useEffect(() => {
    (async () => {
      const doc = await loadDocumentByKey(initialSource.id, async () => initialSource.bytes);
      loadInitialSource(initialSource, doc.numPages);
    })().catch((e) => toast.error(e?.message ?? "Failed to open PDF"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first page when loaded / after deletes
  useEffect(() => {
    if (state.pages.length === 0) {
      setSelectedPageId(null);
      return;
    }
    if (!selectedPageId || !state.pages.find((p) => p.id === selectedPageId)) {
      setSelectedPageId(state.pages[0].id);
    }
  }, [state.pages, selectedPageId]);

  // Keyboard: Delete removes selection, arrow keys navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedPageId) {
        e.preventDefault();
        removePage(selectedPageId);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        const idx = state.pages.findIndex((p) => p.id === selectedPageId);
        if (idx >= 0 && idx < state.pages.length - 1) setSelectedPageId(state.pages[idx + 1].id);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        const idx = state.pages.findIndex((p) => p.id === selectedPageId);
        if (idx > 0) setSelectedPageId(state.pages[idx - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.pages, selectedPageId, undo, redo, removePage]);

  const selectedPage = useMemo(
    () => state.pages.find((p) => p.id === selectedPageId) ?? null,
    [state.pages, selectedPageId],
  );
  const selectedIndex = selectedPage ? state.pages.indexOf(selectedPage) : -1;

  async function handleAddPages(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: not a PDF`);
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const src: PdfSource = { id: crypto.randomUUID(), name: file.name, bytes };
        const doc = await loadDocumentByKey(src.id, async () => src.bytes);
        addSource(src, doc.numPages);
        toast.success(`Added ${doc.numPages} page${doc.numPages === 1 ? "" : "s"} from ${file.name}`);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "load failed"}`);
      }
    }
    if (addPagesInputRef.current) addPagesInputRef.current.value = "";
  }

  async function handleDownload() {
    if (state.pages.length === 0) {
      toast.error("No pages to export");
      return;
    }
    setExporting(true);
    try {
      const bytes = await exportPdf(state);
      downloadBytes(bytes, `${docName}-edited.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <div className="truncate text-sm font-medium">{docName}</div>

        <div className="mx-4 hidden items-center gap-1 rounded-lg border border-border bg-background p-1 md:flex">
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")} label="Select">
            <MousePointer2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn active={tool === "highlight"} onClick={() => setTool("highlight")} label="Highlight">
            <Highlighter className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "strikethrough"}
            onClick={() => setTool("strikethrough")}
            label="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn active={tool === "note"} onClick={() => setTool("note")} label="Note">
            <StickyNote className="h-4 w-4" />
          </ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={undo} disabled={!canUndo} label="Undo (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={redo} disabled={!canRedo} label="Redo (Ctrl+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={() => addPagesInputRef.current?.click()} label="Add pages from PDF">
            <FilePlus className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedPageId && rotatePage(selectedPageId, 90)}
            disabled={!selectedPageId}
            label="Rotate 90°"
          >
            <RotateCw className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedPageId && removePage(selectedPageId)}
            disabled={!selectedPageId}
            label="Delete page"
          >
            <Trash2 className="h-4 w-4" />
          </ToolBtn>
        </div>

        <input
          ref={addPagesInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          multiple
          onChange={(e) => handleAddPages(e.target.files)}
        />

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShareOpen(true)}
            disabled={state.pages.length === 0}
          >
            <Share2 className="mr-1 h-4 w-4" />
            Share &amp; Track
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={exporting || state.pages.length === 0}>
            {exporting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Download
          </Button>
        </div>
      </header>

      <ShareTrackDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        getPdfBytes={getExportedBytes}
        pageCount={state.pages.length}
        docName={docName}
      />

      <div className="flex flex-1 overflow-hidden">
        <ThumbnailSidebar
          selectedId={selectedPageId}
          onSelect={setSelectedPageId}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-muted p-6">
            <div className="mx-auto max-w-4xl">
              {selectedPage ? (
                <PageViewer key={selectedPage.id} pageId={selectedPage.id} tool={tool} />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No pages. Use "Add pages" to import from another PDF.
                </div>
              )}
            </div>
          </div>
          <div className="flex h-12 items-center justify-center gap-3 border-t border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              disabled={selectedIndex <= 0}
              onClick={() => setSelectedPageId(state.pages[selectedIndex - 1].id)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm tabular-nums text-muted-foreground">
              {selectedIndex >= 0 ? selectedIndex + 1 : 0} / {state.pages.length}
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={selectedIndex < 0 || selectedIndex >= state.pages.length - 1}
              onClick={() => setSelectedPageId(state.pages[selectedIndex + 1].id)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbnailSidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { state, reorderPages, rotatePage, removePage } = useEditor();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = state.pages.map((p) => p.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderPages(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3 md:block">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages</div>
        <div className="text-xs text-muted-foreground">{state.pages.length}</div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={state.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {state.pages.map((p, i) => (
              <ThumbnailItem
                key={p.id}
                pageId={p.id}
                index={i}
                selected={p.id === selectedId}
                onSelect={() => onSelect(p.id)}
                onRotate={() => rotatePage(p.id, 90)}
                onDelete={() => removePage(p.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  );
}

function ThumbnailItem({
  pageId,
  index,
  selected,
  onSelect,
  onRotate,
  onDelete,
}: {
  pageId: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const { state } = useEditor();
  const page = state.pages.find((p) => p.id === pageId)!;
  const source = state.sources[page.sourceId];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pageId,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "group relative overflow-hidden rounded-md border-2 bg-background transition " +
        (selected ? "border-brand ring-2 ring-brand/20" : "border-border hover:border-brand/50")
      }
    >
      <button
        onClick={onSelect}
        {...attributes}
        {...listeners}
        className="block w-full cursor-grab p-1 active:cursor-grabbing"
      >
        <PdfPageCanvas
          sourceKey={source.id}
          getBytes={async () => source.bytes}
          pageIndex={page.sourceIndex}
          rotation={page.rotation}
          className="pointer-events-none"
        />
        <div className="pt-1 text-center text-[11px] text-muted-foreground">Page {index + 1}</div>
      </button>
      <div className="pointer-events-none absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          className="rounded bg-background/95 p-1 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
          aria-label="Rotate"
        >
          <RotateCw className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded bg-background/95 p-1 text-destructive shadow ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function PageViewer({ pageId, tool }: { pageId: string; tool: EditorTool }) {
  const { state } = useEditor();
  const page = state.pages.find((p) => p.id === pageId);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  if (!page) return null;
  const source = state.sources[page.sourceId];
  return (
    <div className="mx-auto w-full">
      <div
        className="relative mx-auto rounded-md bg-white shadow-elevated"
        style={{ width: size?.width, height: size?.height }}
      >
        <PdfPageCanvas
          sourceKey={source.id}
          getBytes={async () => source.bytes}
          pageIndex={page.sourceIndex}
          rotation={page.rotation}
          targetWidth={880}
          onSize={setSize}
        />
        {size && (
          <AnnotationLayer
            page={page}
            sourceKey={source.id}
            getBytes={async () => source.bytes}
            displayWidth={size.width}
            displayHeight={size.height}
            tool={tool}
          />
        )}
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors " +
        (disabled
          ? "text-muted-foreground/40"
          : active
            ? "bg-primary-soft text-brand"
            : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

// Keep the guest upload helper referenced so tree-shaking doesn't drop it
// (used when user drops another PDF onto the home page and lands here).
void putGuestPdf;
