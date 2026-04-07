import { LayoutDashboard, PlusCircle, CreditCard, Landmark, LineChart, Target, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Lançar", url: "/lancamentos", icon: PlusCircle },
  { title: "Parcelas", url: "/parcelamentos", icon: CreditCard },
  { title: "Invest.", url: "/investimentos", icon: Landmark },
  { title: "Análises", url: "/analises", icon: LineChart },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Config", url: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex overflow-x-auto scrollbar-hide py-2 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground text-[10px] transition-colors shrink-0 min-w-[56px]"
            activeClassName="text-primary font-medium"
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
