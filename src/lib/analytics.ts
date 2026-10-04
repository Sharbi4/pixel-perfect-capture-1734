// Optional marketing-site analytics. Never include checkout, account or dashboard URLs.
const measurementId = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"] as
  string | undefined;
export const analyticsPreferenceKey = "spa:analytics-consent:v1";
declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
let initialized = false;
function gtag(..._args: unknown[]) {
  window.dataLayer ||= [];
  window.dataLayer.push(arguments);
}
export function analyticsAllowed() {
  try {
    return localStorage.getItem(analyticsPreferenceKey) === "yes";
  } catch {
    return false;
  }
}
export function initAnalytics() {
  if (
    typeof window === "undefined" ||
    /^\/(auth|checkout|complete-account|setup|account|dashboard|api|mcp)(\/|$)/.test(
      window.location.pathname,
    ) ||
    !analyticsAllowed() ||
    !measurementId ||
    initialized
  )
    return;
  initialized = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);
  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}
export function trackPageView(path: string) {
  if (
    !analyticsAllowed() ||
    !measurementId ||
    /^\/(auth|checkout|complete-account|setup|account|dashboard|api|mcp)(\/|$)/.test(path)
  )
    return;
  initAnalytics();
  gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}
export function setAnalyticsPreference(allowed: boolean) {
  try {
    localStorage.setItem(analyticsPreferenceKey, allowed ? "yes" : "no");
  } catch {}
  if (measurementId) {
    (window as unknown as Record<string, unknown>)["ga-disable-" + measurementId] = !allowed;
  }
  if (allowed) trackPageView(window.location.pathname);
}
