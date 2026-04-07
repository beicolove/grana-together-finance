import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import Installments from "./pages/Installments";
import Investments from "./pages/Investments";
import Analysis from "./pages/Analysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <ProfileProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Transactions />} />
          <Route path="/parcelamentos" element={<Installments />} />
          <Route path="/investimentos" element={<Investments />} />
          <Route path="/analises" element={<Analysis />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </ProfileProvider>
  );
}

type AppState = "loading" | "auth" | "app" | "error";

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Listen for auth changes (fires on INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAppState(session ? "app" : "auth");
    });

    // Get current session immediately (handles page refresh)
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error("[Grana] Erro ao obter sessão:", error.message);
          // Don't block the app — fall back to auth screen
        }
        setSession(session);
        setAppState(session ? "app" : "auth");
      })
      .catch((err) => {
        console.error("[Grana] Falha na conexão com Supabase:", err);
        setErrorMsg(
          "Não foi possível conectar ao servidor. Verifique sua conexão ou as variáveis de ambiente do Supabase."
        );
        setAppState("error");
      });

    return () => subscription.unsubscribe();
  }, []);

  if (appState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="text-4xl">💰</div>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (appState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold">Erro de conexão</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm underline text-primary"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {session ? (
            <ProtectedRoutes />
          ) : (
            <Routes>
              <Route path="*" element={<Auth />} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
