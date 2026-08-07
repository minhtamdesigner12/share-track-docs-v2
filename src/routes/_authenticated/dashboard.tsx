import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { BarChart3, FileText, MoreHorizontal, Trash2, Users, Percent } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PdfUpload } from "@/components/pdf-upload";
import { Button } from "@/components/ui/button";
import { listMyDocuments, deleteDocument } from "@/lib/pdf.functions";
import { getDashboardStats } from "@/lib/share.functions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Dashboard() {
  const listFn = useServerFn(listMyDocuments);
  const deleteFn = useServerFn(deleteDocument);
  const statsFn = useServerFn(getDashboardStats);
  const qc = useQueryClient();

  const { data: docs, isLoading } = useQuery({
    queryKey: ["docs"],
    queryFn: () => listFn(),
  });

  const docIds = docs?.map((d) => d.id) ?? [];
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", docIds],
    queryFn: () => statsFn({ data: { documentIds: docIds } }),
    enabled: docIds.length > 0,
    refetchInterval: 30_000,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("PDF deleted");
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My PDFs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload, edit, and share your PDFs with tracking.
            </p>
          </div>
        </div>

        <PdfUpload />

        <div className="mt-12">
          <h2 className="text-lg font-semibold">Recent</h2>
          {isLoading ? (
            <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
          ) : !docs?.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No PDFs yet. Upload one above to get started.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {docs.map((d) => {
                const s = stats?.[d.id];
                return (
                <div key={d.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-brand">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/workspace/$docId"
                      params={{ docId: d.id }}
                      className="block truncate font-medium hover:text-brand"
                    >
                      {d.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {d.page_count} pages · {formatBytes(d.size_bytes)} ·{" "}
                      Uploaded {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="hidden shrink-0 gap-4 text-xs text-muted-foreground sm:flex">
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                        <Users className="h-3 w-3" /> Viewers
                      </div>
                      <div className="font-semibold text-foreground">
                        {s ? s.uniqueViewers : "–"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide">Sessions</div>
                      <div className="font-semibold text-foreground">
                        {s ? s.totalSessions : "–"}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                        <Percent className="h-3 w-3" /> Completion
                      </div>
                      <div className="font-semibold text-foreground">
                        {s && s.totalSessions > 0 ? `${s.avgCompletion.toFixed(0)}%` : "–"}
                      </div>
                    </div>
                    <div className="w-24">
                      <div className="text-[10px] uppercase tracking-wide">Last viewed</div>
                      <div className="font-semibold text-foreground">
                        {s?.lastViewed
                          ? formatDistanceToNow(new Date(s.lastViewed), { addSuffix: true })
                          : "Never"}
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/analytics/$docId" params={{ docId: d.id }}>
                      <BarChart3 className="mr-1 h-4 w-4" /> Analytics
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/workspace/$docId" params={{ docId: d.id }}>
                      Open
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => del.mutate(d.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
