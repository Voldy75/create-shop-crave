import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pro = await isProUser(user.id);
  return Response.json({ isPro: pro });
}
