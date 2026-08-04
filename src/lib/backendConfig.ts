const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True quando as credenciais do backend estão presentes e válidas. */
export const isBackendConfigured =
  typeof url === 'string' &&
  url.trim().length > 0 &&
  typeof key === 'string' &&
  key.trim().length > 0;
