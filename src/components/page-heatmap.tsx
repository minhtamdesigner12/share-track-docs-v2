import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EventRow {
  session_id: string;
  page_index: number;
  active_ms: number;
  sequence: number;
  entered_at: string;
}

interface SessionRow {
  id: string;
}

interface Props {
  events: EventRow[];
  sessions: SessionRow[];
  pageCount: number;
}

function formatMs(ms: number) {
  if (ms < 1000) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/** Interpolates a "cold to hot" color for a 0..1 intensity value. */
function heatColor(t: number) {
  // 0 -> cool slate, 1 -> warm red/orange, via a brand-ish blue midpoint.
  const clamped = Math.max(0, Math.min(1, t));
  const stops = [
    { p: 0, c: [226, 232, 240] }, // slate-200 (cold / no data)
    { p: 0.45, c: [147, 197, 253] }, // blue-300
    { p: 0.75, c: [251, 191, 36] }, // amber-400
    { p: 1, c: [239, 68, 68] }, // red-500 (hottest)
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].p && clamped <= stops[i + 1].p) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.p - lo.p || 1;
  const localT = (clamped - lo.p) / span;
  const rgb = lo.c.map((v, i) => Math.round(v + (hi.c[i] - v) * localT));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Page-by-page engagement heatmap: total active time per page (color intensity)
 * plus a drop-off funnel showing what share of sessions reached each page.
 */
export function PageHeatmap({ events, sessions, pageCount }: Props) {
  const { perPage, maxMs, totalSessions } = useMemo(() => {
    const totalSessions = sessions.length;
    const perPage = Array.from({ length: pageCount }, (_, i) => ({
      pageIndex: i,
      activeMs: 0,
      reachedSessions: new Set<string>(),
    }));
    for (const e of events) {
      const bucket = perPage[e.page_index];
      if (!bucket) continue;
      bucket.activeMs += e.active_ms;
      bucket.reachedSessions.add(e.session_id);
    }
    // A session "reached" page p if it has an event on any page >= p
    // (people don't always view strictly in order, so use max page seen).
    const maxPageBySession = new Map<string, number>();
    for (const e of events) {
      const cur = maxPageBySession.get(e.session_id) ?? -1;
      if (e.page_index > cur) maxPageBySession.set(e.session_id, e.page_index);
    }
    const reachedCount = perPage.map((_, p) => {
      let count = 0;
      for (const maxPage of maxPageBySession.values()) if (maxPage >= p) count++;
      return count;
    });
    const maxMs = Math.max(1, ...perPage.map((p) => p.activeMs));
    return {
      perPage: perPage.map((p, i) => ({
        ...p,
        reachedCount: reachedCount[i],
      })),
      maxMs,
      totalSessions,
    };
  }, [events, sessions, pageCount]);

  const [hovered, setHovered] = useState<number | null>(null);

  if (!events.length) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4" /> Page engagement heatmap
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-1">
            {perPage.map((p) => {
              const intensity = p.activeMs / maxMs;
              const reachPct = totalSessions ? (p.reachedCount / totalSessions) * 100 : 0;
              return (
                <Tooltip key={p.pageIndex}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onMouseEnter={() => setHovered(p.pageIndex)}
                      onMouseLeave={() => setHovered(null)}
                      className="h-7 w-7 shrink-0 rounded-[3px] transition-transform hover:z-10 hover:scale-125 sm:h-8 sm:w-8"
                      style={{
                        backgroundColor: heatColor(intensity),
                        outline: hovered === p.pageIndex ? "2px solid var(--brand)" : "none",
                      }}
                      aria-label={`Page ${p.pageIndex + 1}: ${formatMs(p.activeMs)} total active time`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="font-semibold">Page {p.pageIndex + 1}</div>
                    <div>{formatMs(p.activeMs)} total active time</div>
                    <div>
                      {p.reachedCount}/{totalSessions} sessions reached this page (
                      {reachPct.toFixed(0)}%)
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Less time</span>
            <div
              className="h-2 w-24 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, rgb(226,232,240), rgb(147,197,253), rgb(251,191,36), rgb(239,68,68))",
              }}
            />
            <span>More time</span>
            <span className="ml-auto">Hover a page for details · drop-off shown per page</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
