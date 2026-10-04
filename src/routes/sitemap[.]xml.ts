import { createFileRoute } from "@tanstack/react-router";

/**
 * Served at /sitemap.xml. Only public, indexable pages are listed —
 * authenticated pages (/setup, /account) and API endpoints stay out.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = process.env["PUBLIC_APP_ORIGIN"]?.replace(/\/$/, "") || "https://salonagentai.com";
        const lastmod = new Date().toISOString().slice(0, 10);

        const urls = ["", "/auth"]
          .map(
            (path) =>
              `  <url>\n    <loc>${origin}/${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
