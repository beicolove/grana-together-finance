import { useEffect } from "react";
import { LayoutDashboard, PlusCircle, BarChart3, Target, Settings, CreditCard, Landmark, LineChart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ProfileSelector } from "@/components/ProfileSelector";
import { MobileNav } from "@/components/MobileNav";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "Dashboard",     url: "/",               icon: LayoutDashboard },
  { title: "Lançamentos",   url: "/lancamentos",    icon: PlusCircle },
  { title: "Parcelamentos", url: "/parcelamentos",  icon: CreditCard },
  { title: "Investimentos", url: "/investimentos",  icon: Landmark },
  { title: "Análises",      url: "/analises",       icon: LineChart },
  { title: "Relatórios",    url: "/relatorios",     icon: BarChart3 },
  { title: "Metas",         url: "/metas",          icon: Target },
  { title: "Configurações", url: "/configuracoes",  icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeProfile, loading, fetchError } = useProfile();
  const color = activeProfile?.color ?? "blue";

  useEffect(() => {
    document.documentElement.setAttribute("data-profile", color);
  }, [color]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="text-4xl">💰</div>
          <p className="text-sm text-muted-foreground">Carregando perfis...</p>
        </div>
      </div>
    );
  }

  // SQL not run yet — tables don't exist
  if (fetchError === "nenhum-perfil" || (fetchError && fetchError.includes("profiles"))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-4xl">🗄️</div>
          <h2 className="text-xl font-bold">Banco de dados não configurado</h2>
          <p className="text-sm text-muted-foreground">
            {fetchError === "nenhum-perfil"
              ? "Nenhum perfil encontrado. Execute o SQL de configuração no painel do Supabase para criar as tabelas e perfis iniciais."
              : fetchError}
          </p>
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 text-left font-mono">
            Acesse: supabase.com/dashboard → SQL Editor → cole e execute o script de configuração.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm underline text-muted-foreground"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  // Other fetch error
  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold">Erro ao carregar</h2>
          <p className="text-sm text-muted-foreground">{fetchError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="text-sm underline text-primary">
              Tentar novamente
            </button>
            <button onClick={() => supabase.auth.signOut()} className="text-sm underline text-muted-foreground">
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-card">
        {/* Logo + perfis */}
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <span className="text-lg font-bold tracking-tight">💰 Grana</span>
          <ProfileSelector />
        </div>

        {/* Nav tabs — desktop only */}
        <nav className="hidden md:flex gap-1 px-4 md:px-6 border-t border-border/50 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground border-b-2 border-transparent -mb-px shrink-0"
              activeClassName="text-foreground font-medium border-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-8 overflow-auto">
        {children}
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────── */}
      <MobileNav />
    </div>
  );
}
