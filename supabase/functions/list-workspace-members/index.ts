import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is owner
    const { data: callerMember } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", caller.id)
      .single();

    if (!callerMember || callerMember.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can access this" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace members
    const { data: members } = await supabaseAdmin
      .from("workspace_members")
      .select("id, user_id, role, joined_at")
      .eq("workspace_id", callerMember.workspace_id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ members: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, photo_url, birth_date")
      .in("id", userIds);

    const profilesMap = new Map();
    if (profiles) {
      for (const p of profiles) {
        profilesMap.set(p.id, p);
      }
    }

    // Get emails from auth.users via admin API
    const membersWithEmail = [];
    for (const member of members) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      const email = userError ? "" : (userData?.user?.email || "");
      membersWithEmail.push({
        ...member,
        email,
        profile: profilesMap.get(member.user_id) || null,
      });
    }

    return new Response(JSON.stringify({ members: membersWithEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
