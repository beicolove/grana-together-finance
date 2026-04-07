import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  date: string;
  category_id: string | null;
  trip_id: string | null;
};

type Trip = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

const CHART_COLORS = ["#E91E8C", "#8B5CF6", "#00E676", "#FF5252", "#378ADD", "#1D9E75", "#14B8A6", "#F97316"];

function MonthSelector({
  selected,
  onChange,
}: {
  selected: Date;
  onChange: (d: Date) => void;
}) {
  const label = format(selected, "MMMM yyyy", { locale: ptBR });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(subMonths(selected, 1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[130px] text-center">{capitalized}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(addMonths(selected, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { activeProfile, isCasal } = useProfile();
  const isCouple = isCasal;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    if (!activeProfile) return;
    const load = async () => {
      const { data: txns } = await supabase
        .from("transactions")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("date", { ascending: false });
      setTransactions(txns || []);

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("profile_id", activeProfile.id);
      setCategories(cats || []);

      if (isCouple) {
        const { data: t } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
        setTrips(t || []);
        if (t && t.length > 0 && !selectedTrip) setSelectedTrip(t[0].id);
      }
    };
    load();
  }, [activeProfile]);

  if (!activeProfile) return null;

  const now = new Date();

  // --- Filtered transactions for the selected month (non-couple) ---
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const currentTrip = trips.find((t) => t.id === selectedTrip);

  const filteredTxns = isCouple
    ? (currentTrip ? transactions.filter((t) => t.trip_id === selectedTrip) : [])
    : transactions.filter(
        (t) => t.date >= format(monthStart, "yyyy-MM-dd") && t.date <= format(monthEnd, "yyyy-MM-dd")
      );

  const income = filteredTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = filteredTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expenses;
  const totalSaved = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
    - transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const tripDays = currentTrip
    ? differenceInDays(new Date(currentTrip.end_date), new Date(currentTrip.start_date)) + 1
    : 0;

  // --- Bar chart: always last 6 months from today (historical, not filtered by selectedMonth) ---
  const barData = isCouple && currentTrip
    ? (() => {
        const days: Record<string, { day: string; gastos: number }> = {};
        filteredTxns.forEach((t) => {
          const day = format(new Date(t.date), "dd/MM");
          if (!days[day]) days[day] = { day, gastos: 0 };
          if (t.type === "expense") days[day].gastos += Number(t.amount);
        });
        return Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
      })()
    : Array.from({ length: 6 }, (_, i) => {
        const m = subMonths(now, 5 - i);
        const ms = format(startOfMonth(m), "yyyy-MM-dd");
        const me = format(endOfMonth(m), "yyyy-MM-dd");
        const monthTxns = transactions.filter((t) => t.date >= ms && t.date <= me);
        return {
          month: format(m, "MMM", { locale: ptBR }),
          receita: monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
          gastos: monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
        };
      });

  // --- Pie chart: filtered by selected month (or trip for couple) ---
  const expByCategory: Record<string, number> = {};
  filteredTxns
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const name = cat ? `${cat.emoji} ${cat.name}` : "Outros";
      expByCategory[name] = (expByCategory[name] || 0) + Number(t.amount);
    });
  const pieData = Object.entries(expByCategory).map(([name, value]) => ({ name, value }));

  const recent = filteredTxns.slice(0, 5);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = isCouple
    ? [
        { label: "Receita do período", value: income, icon: TrendingUp, positive: true },
        { label: "Gasto total", value: expenses, icon: TrendingDown, positive: false },
        { label: "Saldo", value: balance, icon: Wallet, positive: balance >= 0 },
        { label: "Dias de viagem", value: tripDays, icon: CalendarDays, positive: true, raw: true },
      ]
    : [
        { label: "Receita do mês", value: income, icon: TrendingUp, positive: true },
        { label: "Gastos do mês", value: expenses, icon: TrendingDown, positive: false },
        { label: "Saldo do mês", value: balance, icon: Wallet, positive: balance >= 0 },
        { label: "Total economizado", value: totalSaved, icon: PiggyBank, positive: totalSaved >= 0 },
      ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          {isCouple && (
            <p className="text-xs text-muted-foreground mt-0.5">Perfil Casal — períodos de viagem</p>
          )}
        </div>

        {isCouple ? (
          <Select value={selectedTrip} onValueChange={setSelectedTrip}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecionar viagem" />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <MonthSelector selected={selectedMonth} onChange={setSelectedMonth} />
        )}
      </div>

      {isCouple && !currentTrip && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma viagem selecionada</p>
          <p className="text-xs mt-1">Crie um período de viagem em Configurações para começar a registrar.</p>
        </div>
      )}

      {(!isCouple || currentTrip) && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="border-[0.5px]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <kpi.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{kpi.label}</span>
                  </div>
                  <p className={`text-xl md:text-2xl font-bold ${
                    kpi.raw ? "" : kpi.positive ? "text-positive" : "text-negative"
                  }`}>
                    {kpi.raw ? kpi.value : fmt(kpi.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly Summary */}
          {!isCouple && (
            <Card className="border-[0.5px] bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Resumo de {format(selectedMonth, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-lg bg-background border border-[0.5px] p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-500" /> Total de Receitas
                    </p>
                    <p className="text-lg font-bold text-emerald-500">{fmt(income)}</p>
                  </div>
                  <div className="rounded-lg bg-background border border-[0.5px] p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-rose-500" /> Total de Despesas
                    </p>
                    <p className="text-lg font-bold text-rose-500">{fmt(expenses)}</p>
                  </div>
                </div>
                <div className={`rounded-lg p-3 text-center ${balance >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"}`}>
                  <p className="text-xs text-muted-foreground mb-0.5">Saldo Final</p>
                  <p className={`text-2xl font-extrabold ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {balance >= 0 ? "+" : ""}{fmt(balance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-[0.5px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {isCouple ? "Gastos por dia" : "Receita x Gastos (6 meses)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey={isCouple ? "day" : "month"} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    {isCouple ? (
                      <Bar dataKey="gastos" fill="#E91E8C" radius={[4, 4, 0, 0]} />
                    ) : (
                      <>
                        <Bar dataKey="receita" fill="#00E676" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gastos" fill="#FF5252" radius={[4, 4, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-[0.5px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gastos por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent transactions */}
          <Card className="border-[0.5px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Últimos lançamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {recent.map((t) => {
                    const cat = categories.find((c) => c.id === t.category_id);
                    return (
                      <div key={t.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{cat?.emoji || "📋"}</span>
                          <div>
                            <p className="text-sm font-medium">{t.description || cat?.name || "Sem descrição"}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(t.date), "dd/MM/yyyy")}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${t.type === "income" ? "text-positive" : "text-negative"}`}>
                          {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
