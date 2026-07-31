import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  MousePointer2,
  Redo2,
  Share2,
  StickyNote,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { getDocument } from "@/lib/pdf.functions";
import { PdfPageCanvas } from "@/modules/pdf-render/PdfPageCanvas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workspace/$docId")({
  component: Workspace,
});

function Workspace() {
  const { docId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getDocument);
  const [page, setPage] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [tool, setTool] = useState<"select" | "highlight" | "strikethrough" | "note">("select");

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["doc", docId],
    queryFn: () => getFn({ data: { id: docId } }),
    staleTime: 60_000,
  });

  useEffect(() => {
    setPage(0);
  }, [docId]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading PDF…</div>;
  }
  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load PDF.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top toolbar */}
      <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <div className="truncate text-sm font-medium">{doc.name}</div>

        <div className="mx-4 hidden items-center gap-1 rounded-lg border border-border bg-background p-1 md:flex">
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")} label="Select">
            <MousePointer2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "highlight"}
            onClick={() => {
              setTool("highlight");
              toast.info("Annotation tools ship in Phase 2");
            }}
            label="Highlight"
          >
            <Highlighter className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "strikethrough"}
            onClick={() => {
              setTool("strikethrough");
              toast.info("Annotation tools ship in Phase 2");
            }}
            label="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "note"}
            onClick={() => {
              setTool("note");
              toast.info("Annotation tools ship in Phase 2");
            }}
            label="Note"
          >
            <StickyNote className="h-4 w-4" />
          </ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={() => toast.info("Undo/redo ships with page edits (Phase 2)")} label="Undo">
            <Undo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => toast.info("Undo/redo ships with page edits (Phase 2)")} label="Redo">
            <Redo2 className="h-4 w-4" />
          </ToolBtn>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={doc.signedUrl} download={`${doc.name}.pdf`}>
              <Download className="mr-1 h-4 w-4" /> Download
            </a>
          </Button>
          <Button size="sm" onClick={() => toast.info("Share & Track ships in Phase 3")}>
            <Share2 className="mr-1 h-4 w-4" /> Share
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar thumbnails */}
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3 md:block">
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pages
          </div>
          <div className="space-y-2">
            {Array.from({ length: numPages || doc.page_count }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={
                  "block w-full overflow-hidden rounded-md border-2 bg-background p-1 transition " +
                  (i === page ? "border-brand ring-2 ring-brand/20" : "border-border hover:border-brand/50")
                }
              >
                <PdfPageCanvas url={doc.signedUrl} pageIndex={i} className="pointer-events-none" />
                <div className="pt-1 text-center text-[11px] text-muted-foreground">Page {i + 1}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Center viewer */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-muted p-6">
            <div className="mx-auto max-w-4xl">
              <PdfPageCanvas
                url={doc.signedUrl}
                pageIndex={page}
                onNumPages={(n) => setNumPages(n)}
              />
            </div>
          </div>
          <div className="flex h-12 items-center justify-center gap-3 border-t border-border bg-card">
            <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm tabular-nums text-muted-foreground">
              {page + 1} / {numPages || doc.page_count}
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={numPages > 0 && page >= numPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors " +
        (active ? "bg-primary-soft text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
