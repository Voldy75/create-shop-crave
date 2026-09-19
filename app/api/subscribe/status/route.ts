import { requireUser } from "@/lib/auth-guard";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const pro = await isProUser(user.id);
  return Response.json({ isPro: pro });
}
