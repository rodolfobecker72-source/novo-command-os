import { supabase } from '@/integrations/supabase/client';

const MESSAGES: [RegExp, string][] = [
  [/not authenticated/i, 'Sua sessão expirou. Entre novamente.'],
  [/only owners/i, 'Apenas o Dono da conta pode fazer isso.'],
  [/restrito ao administrador do sistema/i, 'Acesso restrito ao administrador do sistema.'],
  [/(user|member) not found in this workspace/i, 'Usuário não encontrado nesta empresa.'],
  [/cannot remove the owner/i, 'O Dono da conta não pode ser removido.'],
  [/invalid role/i, 'Papel inválido.'],
  [/invalid email/i, 'E-mail inválido.'],
  [/password must be at least/i, 'A senha deve ter pelo menos 6 caracteres.'],
  [/missing required fields|required/i, 'Preencha todos os campos obrigatórios.'],
  [/already (been )?registered|already exists/i, 'Já existe um usuário com este e-mail.'],
];

function translate(message: string): string {
  return MESSAGES.find(([re]) => re.test(message))?.[1] ?? message;
}

/**
 * Calls a Supabase edge function and turns failures into a readable
 * Portuguese message (the client otherwise only reports "Edge Function
 * returned a non-2xx status code"). A 401 means the session is gone (e.g.
 * logged out on another tab), so the user is signed out and sent to login.
 */
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: unknown },
): Promise<{ data: T | null; error: { message: string; status?: number } | null }> {
  const { data, error } = await supabase.functions.invoke(name, options as any);

  if (!error) {
    if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
      return { data: null, error: { message: translate(String((data as any).error)) } };
    }
    return { data: data as T, error: null };
  }

  const context = (error as any).context as Response | undefined;
  const status = context?.status;
  let message = error.message;
  try {
    const body = await context?.clone().json();
    if (body?.error) message = String(body.error);
  } catch {
    // body is not JSON
  }

  if (status === 401) {
    await supabase.auth.signOut();
    return { data: null, error: { message: 'Sua sessão expirou. Entre novamente.', status } };
  }
  return { data: null, error: { message: translate(message), status } };
}
