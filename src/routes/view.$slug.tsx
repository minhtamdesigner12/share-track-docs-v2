import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Lock,
  Mail,
  Maximize2,
} from "lucide-react";
import { PdfPageCanvas } from "@/modules/pdf-render/PdfPageCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolveShareLink,
  startViewSession,
  recordSessionUpdate,
} from "@/lib/viewer.functions";
import { createViewerTracker, getOrCreateAnonId } from "@/modules/tracking/tracker";

export const Route = createFileRoute("/view/$slug")({
  ssr: false,
  component: PublicViewer,
  head: () => ({
    meta: [
      { title: "Shared PDF — iEduPDF" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type ResolvedOk = {
  ok: true;
  shareLinkId: string;
  documentId: string;
  docName: string;
  pageCount: number;
  allowDownload: boolean;
  label: string | null;
  signedUrl: string;
};

function PublicViewer() {
  const { slug } = Route.useParams();
  const resolveFn = useServerFn(resolveShareLink);
  const startFn = useServerFn(startViewSession);
  const recordFn = useServerFn(recordSessionUpdate);

  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "lead"; error?: string }
    | { kind: "password"; wrong?: boolean }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: ResolvedOk; sessionId: string }
  >({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const trackerRef = useRef<ReturnType<typeof createViewerTracker> | null>(null);

  async function tryResolve(pwd?: string) {
    const res = await resolveFn({
      data: {
        slug,
        password: pwd,
        leadName: leadName.trim() || undefined,
        leadEmail: leadEmail.trim() || undefined,
      },
    });
    if ("ok" in res && res.ok) {
      const session = await startFn({
        data: {
          shareLinkId: res.shareLinkId,
          anonId: getOrCreateAnonId(),
          userAgent: navigator.userAgent.slice(0, 500),
          leadName: leadName.trim() || undefined,
          leadEmail: leadEmail.trim() || undefined,
        },
      });
      setStatus({ kind: "ready", data: res, sessionId: session.sessionId });
      return;
    }
    if ("error" in res) {
      if (res.error === "lead_required") setStatus({ kind: "lead" });
      else if (res.error === "password_required") setStatus({ kind: "password" });
      else if (res.error === "password_wrong")
        setStatus({ kind: "password", wrong: true });
      else if (res.error === "expired")
        setStatus({ kind: "error", message: "This link has expired." });
      else
        setStatus({
          kind: "error",
          message: "This link is invalid or has been disabled.",
        });
    }
  }

  useEffect(() => {
    tryResolve().catch((e) =>
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed to load",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Start / stop tracker when ready
  useEffect(() => {
    if (status.kind !== "ready") return;
    const tracker = createViewerTracker({
      sessionId: status.sessionId,
      pageCount: status.data.pageCount,
      initialPage: 0,
      recordFn: (payload) => recordFn(payload),
      // No dedicated beacon URL; on unload the tracker falls back to firing
      // recordFn directly as a best-effort call (see finalizeBeacon in
      // tracker.ts).
    });
    trackerRef.current = tracker;
    tracker.start();
    return () => {
      void tracker.stop();
      trackerRef.current = null;
    };
  }, [status.kind === "ready" ? status.sessionId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify tracker of page changes
  useEffect(() => {
    trackerRef.current?.setPage(page);
  }, [page]);

  // Keyboard navigation
  useEffect(() => {
    if (status.kind !== "ready") return;
    const pageCount = status.data.pageCount;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setPage((p) => Math.min(pageCount - 1, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
      } else if (e.key === "Home") {
        setPage(0);
      } else if (e.key === "End") {
        setPage(pageCount - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  const totalPages = status.kind === "ready" ? status.data.pageCount : 0;

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading PDF…
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{status.message}</p>
        </div>
      </div>
    );
  }

  if (status.kind === "lead") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <form
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-soft"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!leadName.trim() || !leadEmail.trim()) return;
            setLeadSubmitting(true);
            await tryResolve(password).finally(() => setLeadSubmitting(false));
          }}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-brand">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center text-lg font-semibold">
            Please introduce yourself
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Enter your name and email to view this document.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="leadName">Name</Label>
              <Input
                id="leadName"
                autoFocus
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Jane Cooper"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="leadEmail">Email</Label>
              <Input
                id="leadEmail"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="jane@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={leadSubmitting || !leadName.trim() || !leadEmail.trim()}
            className="mt-4 w-full"
          >
            {leadSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </div>
    );
  }

  if (status.kind === "password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <form
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-soft"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwSubmitting(true);
            await tryResolve(password).finally(() => setPwSubmitting(false));
          }}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-brand">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center text-lg font-semibold">Password required</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Enter the password to view this PDF.
          </p>
          <div className="mt-4">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
            {status.wrong && (
              <p className="mt-1 text-xs text-destructive">Incorrect password.</p>
            )}
          </div>
          <Button type="submit" disabled={pwSubmitting} className="mt-4 w-full">
            {pwSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            View PDF
          </Button>
        </form>
      </div>
    );
  }

  const data = status.data;

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-100">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4 backdrop-blur">
        <FileText className="h-4 w-4 text-neutral-400" />
        <div className="truncate text-sm font-medium">{data.docName}</div>
        <div className="ml-auto flex items-center gap-2">
          {data.allowDownload && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <a href={data.signedUrl} download={`${data.docName}.pdf`}>
                <Download className="mr-1 h-4 w-4" /> Download
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
            className="text-neutral-300 hover:bg-neutral-800 hover:text-white"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
        <div className="mx-auto w-full max-w-4xl rounded-lg bg-white shadow-2xl">
          <PdfPageCanvas key={page} url={data.signedUrl} pageIndex={page} />
        </div>
      </div>

      <footer className="flex h-14 items-center justify-center gap-4 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-[80px] text-center text-sm tabular-nums text-neutral-300">
          {page + 1} / {totalPages}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          className="text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </footer>
    </div>
  );
}
