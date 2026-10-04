import { createFileRoute } from "@tanstack/react-router";

/**
 * Served at /robots.txt. Points crawlers at the sitemap and keeps
 * private app areas (setup, account, APIs) out of search results.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const origin = process.env["PUBLIC_APP_ORIGIN"]?.replace(/\/$/, "") || "https://salonagentai.com";

        const txt = [
          "User-agent: *",
          "Disallow: /setup",
          "Disallow: /account",
          "Disallow: /api/",
          "Allow: /",
          "",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(txt, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
