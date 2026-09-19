import { requireUser } from "@/lib/auth-guard";
import { getUsage } from "@/lib/rate-limit";

export async function GET() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const usage = await getUsage(user.id);
  return new Response(JSON.stringify(usage), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
