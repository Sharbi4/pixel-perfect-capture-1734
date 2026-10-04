// Google Analytics (gtag.js) initialization and SPA page-view tracking.
const measurementId = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let initialized = false;

export function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function initAnalytics() {
  if (initialized || !measurementId || typeof document === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", measurementId);
}

export function trackPageView(path: string) {
  if (!initialized || !measurementId) return;
  gtag("event", "page_view", { page_path: path });
}
