"use client";

/**
 * /favorites — permanently redirected to /recipes.
 *
 * This page used to be the saved shelf, but it was never converted to the web
 * shell: it kept a `.glass-nav` sticky header with a back arrow to /chat — a
 * phone pattern — INSIDE a layout that already has a persistent sidebar, and
 * its cards were inert (nothing re-opened the recipe). /recipes is the w9a
 * build of the same data with a real click-through to the cooking view.
 *
 * Kept as a redirect rather than deleted because the path is linked from
 * outside this file: AppShell's sidebar had it for the whole of Phase 10c, so
 * it is in browser histories and bookmarks. `replace` keeps it out of the back
 * stack, so Back from /recipes does not bounce through here.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FavoritesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/recipes");
  }, [router]);

  return (
    <main className="mbody">
      <div style={{ padding: 32 }}>
        <span className="t-cap">Taking you to your recipes…</span>
      </div>
    </main>
  );
}
