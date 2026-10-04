import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initAnalytics, trackPageView } from "./lib/analytics";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    initAnalytics();
    router.subscribe("onResolved", ({ toLocation }) => {
      trackPageView(toLocation.pathname);
    });
  }

  return router;
};
