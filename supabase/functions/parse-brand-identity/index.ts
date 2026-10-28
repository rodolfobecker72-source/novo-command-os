import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "npm:ai";
import { z } from "npm:zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ThemeSchema = z.object({
  primary: z.string().nullable(),
  highlight: z.string().nullable(),
  secondary: z.string().nullable(),
  accent: z.string().nullable(),
  text: z.string().nullable(),
  highlightBg: z.string().nullable(),
  fontFamily: z.enum(["sans", "serif", "mono"]).nullable(),
});

const HEX = /^#[0-9a-fA-F]{6}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => null);
    const markdown = typeof body?.markdown === "string" ? body.markdown : "";
    if (!markdown.trim()) return json({ error: "Arquivo vazio" }, 400);
    if (markdown.length > 60000) return json({ error: "Arquivo muito grande (máx. 60 mil caracteres)" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "IA não configurada" }, 500);

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "Você extrai a identidade visual de um manual de marca em Markdown para aplicar em documentos PDF. Retorne cores em hex #RRGGBB. primary = cor principal da marca, escura o bastante para títulos e para fundos com texto branco. highlight = cor de destaque/acento da marca (faixas, marcadores e números). secondary = cor secundária (subtítulos/textos de apoio, legível sobre branco). accent = cor de linhas e bordas. text = cor do texto corrido (escura, legível sobre branco). highlightBg = fundo claro para destaques de tabela. fontFamily = sans, serif ou mono conforme a tipografia principal. Use null quando o manual não informar.",
      messages: [{ role: "user", content: markdown }],
      output: Output.object({ schema: ThemeSchema }),
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    let out: z.infer<typeof ThemeSchema>;
    try {
      await result.consumeStream();
      out = await result.output;
    } catch (e) {
      const status = (e as any)?.statusCode ?? (e as any)?.cause?.statusCode;
      if (status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Planos." }, 402);
      if (status === 429) return json({ error: "Muitas solicitações. Tente novamente em instantes." }, 429);
      if (status === 403) return json({ error: "Acesso à IA bloqueado para este workspace." }, 403);
      if (NoObjectGeneratedError.isInstance(e)) return json({ error: "Não foi possível interpretar o arquivo." }, 422);
      throw e;
    }

    const theme: Record<string, string | null> = {};
    for (const k of ["primary", "highlight", "secondary", "accent", "text", "highlightBg"] as const) {
      const v = out[k];
      theme[k] = v && HEX.test(v) ? v.toLowerCase() : null;
    }
    theme.fontFamily = out.fontFamily ?? null;
    return json({ theme });
  } catch (e) {
    console.error("parse-brand-identity error", String(e), (e as any)?.responseBody ?? "");
    return json({ error: "Erro ao processar identidade visual" }, 500);
  }
});
