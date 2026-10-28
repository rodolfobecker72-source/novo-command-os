import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    // Check caller is owner (same rule as create/update/delete-member)
    const { data: callerMember } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", caller.id)
      .single();

    if (!callerMember || callerMember.role !== "owner") {
      return json({ error: "Only owners can reset passwords" }, 403);
    }

    const { targetUserId, new_password } = await req.json();

    if (!targetUserId || !new_password) {
      return json({ error: "targetUserId and new_password required" }, 400);
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Verify target user is in the caller's workspace
    const { data: targetMember } = await supabaseAdmin
      .from("workspace_members")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("workspace_id", callerMember.workspace_id)
      .maybeSingle();

    if (!targetMember) {
      return json({ error: "User not found in this workspace" }, 404);
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: new_password },
    );

    if (updateError) throw updateError;

    return json({ success: true, message: "Password updated" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
