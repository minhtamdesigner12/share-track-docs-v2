import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const GA_ID = "G-X5C3KFFY65"; // Replace with your GA4 Measurement ID

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function GoogleAnalytics() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  // Load GA once
  useEffect(() => {
    if (document.getElementById("ga-script")) return;

    const script = document.createElement("script");
    script.id = "ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      send_page_view: false,
    });
  }, []);

  // Track page changes
  useEffect(() => {
    if (!window.gtag) return;

    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location]);

  return null;
}