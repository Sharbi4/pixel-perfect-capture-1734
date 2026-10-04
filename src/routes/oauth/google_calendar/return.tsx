import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Landing page for the Google OAuth redirect. The connector gateway sends the salon owner
 * back here with a one-time code (never a credential); the popup posts it to the opener,
 * which runs the authenticated server function that exchanges and stores it.
 */
function GoogleCalendarReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google didn't finish the connection.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    // Offline access disabled: consent succeeded with no key to exchange, so
    // signal the opener and close instead of leaving it waiting.
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google finished the connection without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    setMessage("Connected! You can close this window.");
    notifyOpenerAndClose("appUserConnectorOAuthComplete", code);
  }, []);

  return <p className="p-8 text-center text-sm text-muted-foreground">{message}</p>;
}

export const Route = createFileRoute("/oauth/google_calendar/return")({
  component: GoogleCalendarReturn,
});
