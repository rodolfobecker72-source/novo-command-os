// Adds a member to the caller's company. Without a password the person gets
// an invitation e-mail (Supabase Auth "Invite user" template) and creates
// their own password on /reset-password; with a password the account is
// ready to use and no e-mail is sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = (Deno.env.get("APP_URL") ?? "https://acesso.command-os.app.br").replace(/\/$/, "");
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  time_operacional: "Time Operacional",
};

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
      return new Response(JSON.stringify({ error: "Only owners can create members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, name, role, birthDate } = await req.json();

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["admin", "vendedor", "time_operacional"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate password length (only when the owner sets it now)
    if (password && String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newUser: { user: { id: string } | null } | null = null;
    let createError: { message: string } | null = null;
    if (password) {
      // Password set by the owner: ready to use, no e-mail
      ({ data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      }));
    } else {
      // Invitation: the welcome e-mail names the company, who invited and the role
      const [{ data: ws }, { data: inviter }] = await Promise.all([
        supabaseAdmin.from("workspaces").select("name").eq("id", callerMember.workspace_id).single(),
        supabaseAdmin.from("profiles").select("name").eq("id", caller.id).single(),
      ]);
      ({ data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          name,
          workspace_name: ws?.name ?? "",
          invited_by: inviter?.name ?? "",
          role_label: ROLE_LABELS[role] ?? role,
        },
        redirectTo: `${APP_URL}/reset-password`,
      }));
    }

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add to workspace
    const { error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: callerMember.workspace_id,
        user_id: newUser.user!.id,
        role,
        page_permissions: [],
      });

    if (memberError) {
      // Rollback: delete the created user if workspace member insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user!.id);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set birth_date on profile (profile row is auto-created by handle_new_user trigger)
    if (birthDate) {
      await supabaseAdmin
        .from("profiles")
        .update({ birth_date: birthDate })
        .eq("id", newUser.user!.id);
    }

    return new Response(JSON.stringify({ success: true, userId: newUser.user!.id, invited: !password }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
