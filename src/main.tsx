import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isBackendConfigured } from "./lib/backendConfig";

// admin.command-os.app.br serves only the system administration app; every
// other host serves the regular app. Each one is its own bundle.
const isAdminHost =
  window.location.hostname.startsWith("admin.") || import.meta.env.VITE_APP_MODE === "admin";
const App = lazy(() => (isAdminHost ? import("./admin/AdminApp") : import("./App.tsx")));

// Apply persisted theme (dark/light) before render so every page respects it
try {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') document.documentElement.classList.add('dark');
  else if (stored === 'light') document.documentElement.classList.remove('dark');
} catch { /* ignore */ }

function BackendUnavailable() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
      <h1 className="text-xl font-semibold text-foreground">
        Não foi possível conectar ao servidor
      </h1>
      <p className="text-muted-foreground max-w-md">
        A conexão com o servidor não está disponível no momento. Tente recarregar a página em alguns instantes.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        Recarregar página
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  isBackendConfigured ? (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ErrorBoundary>
  ) : (
    <BackendUnavailable />
  )
);
