import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [retrying, setRetrying] = useState(true);

  useEffect(() => {
    reportError(error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  // Auto-retry once for what's often a transient blip (a slow cold start,
  // a flaky network request) before showing a real error. A timestamped
  // flag in sessionStorage prevents looping forever if it keeps failing.
  useEffect(() => {
    const KEY = "__errRetryAt";
    const now = Date.now();
    let last = 0;
    try {
      last = parseInt(sessionStorage.getItem(KEY) || "0", 10);
    } catch {
      /* sessionStorage unavailable — treat as no prior retry */
    }
    if (now - last > 8000) {
      try {
        sessionStorage.setItem(KEY, String(now));
      } catch {
        /* ignore */
      }
      const t = setTimeout(() => {
        router.invalidate();
        reset();
      }, 900);
      return () => clearTimeout(t);
    }
    setRetrying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (retrying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-brand" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Just a moment</h1>
          <p className="mt-2 text-sm text-muted-foreground">Getting things ready…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "iEduPDF — Share PDFs with Trackable Links & Analytics" },
      {
        name: "description",
        content:
          "Turn any PDF into a trackable link. See exactly which pages recipients view and how long they spend — built for pitch decks, proposals, and sales documents. Free to start, no account required to view.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "iEduPDF — Share PDFs with Trackable Links & Analytics" },
      {
        property: "og:description",
        content:
          "Turn any PDF into a trackable link. See exactly which pages recipients view and how long they spend — built for pitch decks, proposals, and sales documents.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://iedupdf.com" },
      { property: "og:site_name", content: "iEduPDF" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "canonical", href: "https://iedupdf.com" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleAnalytics />
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
