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
 * Loads Google Analytics (GA4) once, and reports a page_view on every
 * client-side route change — not just the very first load. TanStack Router
 * navigates without a full page reload, so without this second effect GA
 * would only ever see a single pageview no matter how many pages someone
 * actually visits in a session.
 *
 * Only runs in production builds, and only if VITE_GA_MEASUREMENT_ID is
 * set, so local dev traffic never pollutes real analytics.
 */
export function GoogleAnalytics() {
  const router = useRouter();

  useEffect(() => {
    if (!GA_ID || !import.meta.env.PROD) return;
    if (document.getElementById("ga-gtag-script")) return;

    const script = document.createElement("script");
    script.id = "ga-gtag-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    // IMPORTANT: this must push the special `arguments` object, not a
    // real Array. gtag.js's internal processing distinguishes between the
    // two — pushing a real Array (which is what modern rest params
    // `(...args)` produce) gets silently treated as if it came from a
    // Google Tag Manager container and is just queued for a GTM container
    // that doesn't exist here, instead of being sent as an actual GA4
    // event. That's why the script could load fine (200 OK), throw no
    // errors, and yet nothing ever showed up in Realtime — every event was
    // being silently swallowed at this exact line.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    // The router-change effect below sends page_view on every navigation,
    // including the first one, so we skip GA's automatic initial pageview
    // here to avoid double-counting it.
    window.gtag("config", GA_ID, { send_page_view: false });
  }, []);

  useEffect(() => {
    if (!GA_ID || !import.meta.env.PROD) return;
    const send = () => {
      if (typeof window.gtag !== "function") return;
      window.gtag("event", "page_view", {
        page_path: window.location.pathname + window.location.search,
        page_location: window.location.href,
      });
    };
    // Fire once for the current page, then on every subsequent navigation.
    send();
    return router.history.subscribe(send);
  }, [router]);

  return null;
}