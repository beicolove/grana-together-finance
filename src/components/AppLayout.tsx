import { useEffect } from "react";
import { LayoutDashboard, PlusCircle, BarChart3, Target, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ProfileSelector } from "@/components/ProfileSelector";
import { MobileNav } from "@/components/MobileNav";
import { useProfile } from "@/contexts/ProfileContext";

const navItems = [
  { title: "Dashboard",     url: "/",              icon: LayoutDashboard },
  { title: "Lançamentos",   url: "/lancamentos",   icon: PlusCircle },
  { title: "Relatórios",    url: "/relatorios",    icon: BarChart3 },
  { title: "Metas",         url: "/metas",         icon: Target },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeProfile } = useProfile();
  const profileColor = activeProfile?.color ?? "blue";

  // Aplica data-profile no <html> para que o background cubra a página inteira
  useEffect(() => {
    document.documentElement.setAttribute("data-profile", profileColor);
  }, [profileColor]);

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
        <nav className="hidden md:flex gap-1 px-4 md:px-6 border-t border-border/50">
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground border-b-2 border-transparent -mb-px"
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
