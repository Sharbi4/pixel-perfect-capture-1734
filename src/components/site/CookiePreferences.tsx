import { useEffect, useState } from "react";
import { analyticsPreferenceKey, setAnalyticsPreference } from "@/lib/analytics";
export function CookiePreferences() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(!localStorage.getItem(analyticsPreferenceKey));
    } catch {}
  }, []);
  function choose(value: boolean) {
    setAnalyticsPreference(value);
    setOpen(false);
  }
  return (
    <>
      <button
        className="mt-4 text-xs text-muted-foreground underline"
        onClick={() => setOpen(true)}
      >
        Cookie preferences
      </button>
      {open && (
        <section
          aria-label="Cookie preferences"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-background p-5 shadow-2xl sm:left-auto sm:right-6"
        >
          <h2 className="font-medium">A little insight helps us improve.</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Essential storage keeps your sign-in and preview working. With your permission, Google
            Analytics helps us understand visits to our public pages.{" "}
            <a href="/cookies" className="underline">
              Cookie policy
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => choose(false)}
              className="min-h-11 rounded-full border border-border px-5 text-sm"
            >
              Essential only
            </button>
            <button
              onClick={() => choose(true)}
              className="min-h-11 rounded-full border border-border px-5 text-sm"
            >
              Allow analytics
            </button>
          </div>
        </section>
      )}
    </>
  );
}
