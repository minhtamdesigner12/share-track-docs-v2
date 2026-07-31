/**
 * Client-side engagement tracker for the public PDF viewer.
 *
 * Contract:
 *  - Call `start()` once when the viewer mounts and a valid session exists.
 *  - Call `setPage(index)` whenever the visible page changes.
 *  - Call `stop()` on unmount (best effort — unload also sends a beacon).
 *
 * Active-time rules:
 *  - Counts only while the document is visible AND the tab has focus.
 *  - Pauses after 60s with no user interaction.
 *  - Each page-change flushes the previous page's active_ms to the queue.
 *  - A periodic heartbeat (every 15s) posts the queued events + current
 *    running totals so partial data is preserved if the tab closes.
 *  - On page unload, `navigator.sendBeacon` posts the final update.
 */

interface RecordFn {
  (payload: {
    data: {
      sessionId: string;
      events: {
        pageIndex: number;
        activeMs: number;
        sequence: number;
        enteredAt: string;
      }[];
      lastPage: number;
      totalActiveMs: number;
      uniquePages: number;
      pageCount: number;
      ended?: boolean;
    };
  }): Promise<unknown>;
}

interface TrackerOptions {
  sessionId: string;
  pageCount: number;
  initialPage: number;
  recordFn: RecordFn;
  /**
   * Direct server-fn URL used with navigator.sendBeacon on unload. When we
   * can't discover it we fall back to a synchronous best-effort fetch.
   */
  beaconUrl?: string;
}

const IDLE_MS = 60_000;
const TICK_MS = 1_000;
const HEARTBEAT_MS = 15_000;

export function createViewerTracker(opts: TrackerOptions) {
  let currentPage = opts.initialPage;
  let currentEnteredAt = new Date().toISOString();
  let currentActiveMs = 0;
  let totalActiveMs = 0;
  let sequence = 0;
  const uniquePages = new Set<number>([currentPage]);
  const queue: {
    pageIndex: number;
    activeMs: number;
    sequence: number;
    enteredAt: string;
  }[] = [];
  let lastInteraction = Date.now();
  let tickTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let running = false;
  let stopped = false;

  function isActive() {
    if (typeof document !== "undefined" && document.hidden) return false;
    if (typeof document !== "undefined" && !document.hasFocus()) return false;
    if (Date.now() - lastInteraction > IDLE_MS) return false;
    return true;
  }

  function tick() {
    if (!running) return;
    if (isActive()) {
      currentActiveMs += TICK_MS;
      totalActiveMs += TICK_MS;
    }
  }

  async function heartbeat() {
    if (stopped) return;
    await flush(false).catch(() => {});
  }

  async function flush(ended: boolean) {
    // Snapshot the queue and reset it BEFORE the network call to avoid
    // double-sending events on overlapping heartbeats.
    const events = queue.splice(0, queue.length);
    try {
      await opts.recordFn({
        data: {
          sessionId: opts.sessionId,
          events,
          lastPage: currentPage,
          totalActiveMs,
          uniquePages: uniquePages.size,
          pageCount: opts.pageCount,
          ended,
        },
      });
    } catch (e) {
      // Restore events so the next heartbeat retries them.
      queue.unshift(...events);
      throw e;
    }
  }

  function bumpActivity() {
    lastInteraction = Date.now();
  }

  function setPage(index: number) {
    if (index === currentPage || stopped) return;
    // Finalize the current page's event.
    queue.push({
      pageIndex: currentPage,
      activeMs: currentActiveMs,
      sequence: sequence++,
      enteredAt: currentEnteredAt,
    });
    currentPage = index;
    currentActiveMs = 0;
    currentEnteredAt = new Date().toISOString();
    uniquePages.add(index);
  }

  function start() {
    if (running) return;
    running = true;
    tickTimer = window.setInterval(tick, TICK_MS);
    heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS);

    for (const ev of ["mousemove", "keydown", "scroll", "click", "touchstart", "pointerdown"]) {
      window.addEventListener(ev, bumpActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", bumpActivity);
    window.addEventListener("focus", bumpActivity);
    window.addEventListener("pagehide", finalizeBeacon);
    window.addEventListener("beforeunload", finalizeBeacon);
  }

  function finalizeBeacon() {
    if (stopped) return;
    stopped = true;
    // Finalize current page event locally.
    queue.push({
      pageIndex: currentPage,
      activeMs: currentActiveMs,
      sequence: sequence++,
      enteredAt: currentEnteredAt,
    });
    const body = JSON.stringify({
      data: {
        sessionId: opts.sessionId,
        events: queue,
        lastPage: currentPage,
        totalActiveMs,
        uniquePages: uniquePages.size,
        pageCount: opts.pageCount,
        ended: true,
      },
    });
    const url = opts.beaconUrl;
    if (url && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      } catch {
        /* fall through */
      }
    }
    // Best-effort fetch (may be aborted).
    if (url) {
      try {
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body,
        });
      } catch {
        /* ignore */
      }
    }
  }

  async function stop() {
    if (stopped) return;
    stopped = true;
    if (tickTimer !== null) clearInterval(tickTimer);
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    // finalize current page
    queue.push({
      pageIndex: currentPage,
      activeMs: currentActiveMs,
      sequence: sequence++,
      enteredAt: currentEnteredAt,
    });
    await flush(true).catch(() => {});
    for (const ev of ["mousemove", "keydown", "scroll", "click", "touchstart", "pointerdown"]) {
      window.removeEventListener(ev, bumpActivity);
    }
    document.removeEventListener("visibilitychange", bumpActivity);
    window.removeEventListener("focus", bumpActivity);
    window.removeEventListener("pagehide", finalizeBeacon);
    window.removeEventListener("beforeunload", finalizeBeacon);
  }

  return { start, stop, setPage };
}

export function getOrCreateAnonId(): string {
  const KEY = "iedu_viewer_id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
