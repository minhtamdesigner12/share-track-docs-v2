import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const GA_ID = "G-X5C3KFFY65";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function GoogleAnalytics() {
  useRouterState({
    select: (state) => state.location,
  });

  // Load Google Analytics once
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("ga-script")) {
      const script = document.createElement("script");
      script.id = "ga-script";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];

      window.gtag = (...args: any[]) => {
        window.dataLayer.push(args);
      };

      window.gtag("js", new Date());

      window.gtag("config", GA_ID, {
        send_page_view: false,
      });
    }
  }, []);

  // Track page changes
  const location = useRouterState({
    select: (state) => state.location,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.gtag) return;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
    });
  }, [location]);

  return null;
}