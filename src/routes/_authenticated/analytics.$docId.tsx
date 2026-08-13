import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Users,
  Eye,
  Timer,
  Percent,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { QrCodeButton } from "@/components/qr-code-button";
import { PageHeatmap } from "@/components/page-heatmap";
import { PoweredByFooter } from "@/components/powered-by-footer";
import { toast } from "sonner";
import {
  getSharedDocument,
  listShareLinks,
  getShareLinkAnalytics,
} from "@/lib/share.functions";

export const Route = createFileRoute("/_authenticated/analytics/$docId")({
  component: AnalyticsPage,
});

function formatMs(ms: number) {
  if (ms < 1000) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function AnalyticsPage() {
  const { docId } = Route.useParams();
  const docFn = useServerFn(getSharedDocument);
  const linksFn = useServerFn(listShareLinks);
  const analyticsFn = useServerFn(getShareLinkAnalytics);

  const { data: doc } = useQuery({
    queryKey: ["shared-doc", docId],
    queryFn: () => docFn({ data: { id: docId } }),
  });
  const { data: links, isLoading } = useQuery({
    queryKey: ["share-links", docId],
    queryFn: () => linksFn({ data: { documentId: docId } }),
    refetchInterval: 15_000,
  });

  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const activeLinkId = selectedLinkId ?? links?.[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All PDFs
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {doc?.name ?? "Loading…"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {doc ? `${doc.page_count} pages · Uploaded ${formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}` : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading share links…
          </div>
        ) : !links?.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No trackable links yet.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Share links ({links.length})
              </div>
              {links.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLinkId(l.id)}
                  className={
                    "w-full rounded-xl border p-3 text-left transition-colors " +
                    (activeLinkId === l.id
                      ? "border-brand bg-primary-soft"
                      : "border-border bg-card hover:border-brand/40")
                  }
                >
                  <div className="truncate font-medium">{l.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {l.recipient_name || l.recipient_email || "No recipient info"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{l.stats.viewers} viewers</span>
                    <span>{l.stats.sessions} sessions</span>
                    <span>{formatMs(l.stats.totalMs)} total</span>
                  </div>
                </button>
              ))}
            </aside>

            {activeLinkId && (
              <LinkDetail
                shareLinkId={activeLinkId}
                fetchFn={analyticsFn}
                pageCount={doc?.page_count ?? 1}
              />
            )}
          </div>
        )}
      </main>
      <PoweredByFooter />
    </div>
  );
}

function LinkDetail({
  shareLinkId,
  fetchFn,
  pageCount,
}: {
  shareLinkId: string;
  fetchFn: (args: {
    data: { shareLinkId: string };
  }) => Promise<Awaited<ReturnType<typeof getShareLinkAnalytics>>>;
  pageCount: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["link-analytics", shareLinkId],
    queryFn: () => fetchFn({ data: { shareLinkId } }),
    refetchInterval: 10_000,
  });

  const summary = useMemo(() => {
    if (!data)
      return { opens: 0, viewers: 0, sessions: 0, avgMs: 0, avgCompletion: 0 };
    const sessions = data.sessions;
    const totalMs = sessions.reduce((a, s) => a + (s.active_ms ?? 0), 0);
    const avgMs = sessions.length ? totalMs / sessions.length : 0;
    const avgCompletion = sessions.length
      ? sessions.reduce((a, s) => a + Number(s.completion_pct ?? 0), 0) / sessions.length
      : 0;
    return {
      opens: sessions.length,
      viewers: data.viewers.length,
      sessions: sessions.length,
      avgMs,
      avgCompletion,
    };
  }, [data]);

  async function copyUrl() {
    if (!data) return;
    const url = `${window.location.origin}/view/${data.link.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  const url = `${window.location.origin}/view/${data.link.slug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 w-full sm:w-auto sm:flex-1">
            <div className="text-sm font-semibold">{data.link.label}</div>
            <div className="mt-1 break-all text-xs font-mono text-muted-foreground">{url}</div>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button variant="outline" size="sm" onClick={copyUrl}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
            <Button size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
              </a>
            </Button>
            <QrCodeButton url={url} fileNameHint={data.link.label ?? undefined} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Eye className="h-4 w-4" />} label="Total opens" value={summary.opens} />
        <Stat icon={<Users className="h-4 w-4" />} label="Unique viewers" value={summary.viewers} />
        <Stat icon={<Timer className="h-4 w-4" />} label="Avg active time" value={formatMs(summary.avgMs)} />
        <Stat icon={<Percent className="h-4 w-4" />} label="Avg completion" value={`${summary.avgCompletion.toFixed(0)}%`} />
      </div>

      <PageHeatmap events={data.events} sessions={data.sessions} pageCount={pageCount} />

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4" /> Viewer activity
        </div>
        {data.viewers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No viewers yet. Share the link above and refresh — activity appears here in real time.
          </div>
        ) : (
          <div className="space-y-3">
            {data.viewers.map((v) => (
              <ViewerRow
                key={v.id}
                viewer={v}
                sessions={data.sessions.filter((s) => s.viewer_id === v.id)}
                events={data.events}
                pageCount={pageCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ViewerRow({
  viewer,
  sessions,
  events,
  pageCount,
}: {
  viewer: {
    id: string;
    anon_id: string;
    recipient_name: string | null;
    recipient_email: string | null;
    first_seen: string;
    last_seen: string;
  };
  sessions: {
    id: string;
    started_at: string;
    ended_at: string | null;
    active_ms: number;
    last_page: number | null;
    completion_pct: number;
  }[];
  events: {
    session_id: string;
    page_index: number;
    active_ms: number;
    sequence: number;
    entered_at: string;
  }[];
  pageCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const totalMs = sessions.reduce((a, s) => a + s.active_ms, 0);
  const uniquePages = new Set<number>();
  for (const e of events) {
    if (sessions.some((s) => s.id === e.session_id)) uniquePages.add(e.page_index);
  }
  const completion = pageCount ? (uniquePages.size / pageCount) * 100 : 0;
  const latestSession = [...sessions].sort((a, b) =>
    a.started_at < b.started_at ? 1 : -1,
  )[0];
  const displayName =
    viewer.recipient_name?.trim() ||
    viewer.recipient_email?.trim() ||
    "Anonymous Viewer";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{displayName}</div>
          <div className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} · First{" "}
            {formatDistanceToNow(new Date(viewer.first_seen), { addSuffix: true })} · Last{" "}
            {formatDistanceToNow(new Date(viewer.last_seen), { addSuffix: true })}
          </div>
        </div>
        <div className="hidden gap-4 text-xs text-muted-foreground sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-wide">Active</div>
            <div className="font-semibold text-foreground">{formatMs(totalMs)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide">Completion</div>
            <div className="font-semibold text-foreground">{completion.toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide">Latest stop</div>
            <div className="font-semibold text-foreground">
              Page {(latestSession?.last_page ?? 0) + 1}
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <ul className="space-y-2">
            {sessions.map((s, i) => {
              const sEvents = events
                .filter((e) => e.session_id === s.id)
                .sort((a, b) => a.sequence - b.sequence);
              const seq = sEvents.map((e) => e.page_index + 1);
              const isOpen = expandedSession === s.id;
              return (
                <li key={s.id} className="rounded-lg border border-border bg-card">
                  <button
                    onClick={() =>
                      setExpandedSession(isOpen ? null : s.id)
                    }
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-medium">Session {i + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleString()}
                    </span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {seq.length ? seq.join(" → ") : "no pages"} · Stopped page{" "}
                      {(s.last_page ?? 0) + 1} · {formatMs(s.active_ms)}
                    </span>
                  </button>
                  {isOpen && sEvents.length > 0 && (
                    <div className="border-t border-border px-3 py-2 text-xs">
                      <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                        Per-page time
                      </div>
                      <ul className="space-y-1">
                        {sEvents.map((e, j) => (
                          <li
                            key={j}
                            className="flex items-center justify-between tabular-nums"
                          >
                            <span>Page {e.page_index + 1}</span>
                            <span className="text-muted-foreground">
                              {formatMs(e.active_ms)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
