import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const usage = await getUsage(user.id);
  return new Response(JSON.stringify(usage), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
