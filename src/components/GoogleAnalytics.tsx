import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Loads Google Analytics (GA4) once and reports a page_view
 * on every client-side route change.
 *
 * Only runs in production builds and when
 * VITE_GA_MEASUREMENT_ID is configured.
 */
export function GoogleAnalytics() {
  const router = useRouter();

  // Initialize Google Analytics
  useEffect(() => {
    if (!GA_ID || !import.meta.env.PROD) return;

    // Always initialize dataLayer first.
    window.dataLayer = window.dataLayer || [];

    // Initialize gtag if it doesn't already exist.
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      };
    }

    // Configure GA4.
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      send_page_view: false,
    });

    // Load the Google Analytics script only once.
    if (!document.getElementById("ga-gtag-script")) {
      const script = document.createElement("script");

      script.id = "ga-gtag-script";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;

      document.head.appendChild(script);
    }
  }, []);

  // Track the initial page and every TanStack Router navigation.
  useEffect(() => {
    if (!GA_ID || !import.meta.env.PROD) return;

    const sendPageView = () => {
      if (typeof window.gtag !== "function") return;

      window.gtag("event", "page_view", {
        page_path:
          window.location.pathname + window.location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    };

    // Track the current page.
    sendPageView();

    // Track client-side route changes.
    return router.history.subscribe(sendPageView);
  }, [router]);

  return null;
}