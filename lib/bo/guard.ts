import { requireUser, type GuardResult } from "@/lib/auth-guard";
import { getServerFlag } from "@/lib/feature-flags-server";
import type { Platform } from "@/lib/bo/food-profile";

/**
 * Gate for app/api/bo/*: the bo_agent flag first (off = the routes do not
 * exist, 404), then the usual signed-in, not-banned user.
 */
export async function requireBoUser(): Promise<GuardResult | Response> {
  if (!(await getServerFlag("bo_agent"))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return requireUser();
}

export function platformFrom(v: unknown): Platform | null {
  return v === "web" || v === "ios" || v === "android" ? v : null;
}

/** JSON object body, or null when it is missing or not an object. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
