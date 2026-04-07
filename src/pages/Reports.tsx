import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, TrendingUp, Award } from "lucide-react";

type Transaction = { id: string; amount: number; type: string; date: string; category_id: string | null; trip_id: string | null };
type Category = { id: string; name: string; emoji: string };
type Trip = { id: string; name: string };

export default function Reports() {
  const { activeProfile, isCasal } = useProfile();
  const isCouple = isCasal;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [period, setPeriod] = useState("monthly");
  const [selectedTrip, setSelectedTrip] = useState("");

  useEffect(() => {
    if (!activeProfile) return;
    supabase.from("transactions").select("*").eq("profile_id", activeProfile.id).order("date").then(({ data }) => setTransactions(data || []));
    supabase.from("categories").select("*").eq("profile_id", activeProfile.id).then(({ data }) => setCategories(data || []));
    if (isCouple) {
      supabase.from("trips").select("*").order("start_date", { ascending: false }).then(({ data }) => {
        setTrips(data || []);
        if (data && data.length > 0) setSelectedTrip(data[0].id);
      });
    }
  }, [activeProfile]);

  if (!activeProfile) return null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now = new Date();

  // Para o Casal: filtra os lançamentos pela viagem selecionada
  const scopedTxns = isCouple
    ? transactions.filter((t) => t.trip_id === selectedTrip)
    : transactions;

  // Balance evolution — 12 meses para perfis individuais
  const lineData = Array.from({ length: 12 }, (_, i) => {
    const m = subMonths(now, 11 - i);
    const ms = format(startOfMonth(m), "yyyy-MM-dd");
    const me = format(endOfMonth(m), "yyyy-MM-dd");
    const monthTxns = transactions.filter((t) => t.date >= ms && t.date <= me);
    const inc = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { month: format(m, "MMM/yy", { locale: ptBR }), saldo: inc - exp };
  });

  // Casal: saldo por viagem (nunca por mês calendário)
  const tripSaldoData = trips.map((trip) => {
    const tripTxns = transactions.filter((t) => t.trip_id === trip.id);
    const inc = tripTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = tripTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { name: trip.name, saldo: inc - exp, receita: inc, gastos: exp };
  });

  // Insights — baseados no escopo correto (viagem ou total)
  const allExpenses = scopedTxns.filter((t) => t.type === "expense");
  const catTotals: Record<string, number> = {};
  allExpenses.forEach((t) => {
    const cat = categories.find((c) => c.id === t.category_id);
    const name = cat ? `${cat.emoji} ${cat.name}` : "Outros";
    catTotals[name] = (catTotals[name] || 0) + Number(t.amount);
  });
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const totalIncome = scopedTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = allExpenses.reduce((s, t) => s + Number(t.amount), 0);

  // Comparação de gastos entre viagens
  const tripBarData = trips.map((trip) => {
    const tripTxns = transactions.filter((t) => t.trip_id === trip.id && t.type === "expense");
    return { name: trip.name, gastos: tripTxns.reduce((s, t) => s + Number(t.amount), 0) };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Relatórios</h2>
        {!isCouple ? (
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        ) : (
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
        )}
      </div>

      {/* Insights — filtrados pelo escopo correto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[0.5px]">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Maior gasto</p>
              <p className="font-semibold text-sm">{topCategory ? topCategory[0] : "—"}</p>
              <p className="text-sm text-negative">{topCategory ? fmt(topCategory[1]) : "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[0.5px]">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Total recebido</p>
              <p className="font-semibold text-sm text-positive">{fmt(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[0.5px]">
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="h-8 w-8 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">
                {isCouple ? "Saldo da viagem" : "Economizado"}
              </p>
              <p className={`font-semibold text-sm ${totalIncome - totalExpense >= 0 ? "text-positive" : "text-negative"}`}>
                {fmt(totalIncome - totalExpense)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução — mensal para individuais */}
      {!isCouple && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evolução do saldo (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="saldo" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Casal: saldo e gastos por viagem */}
      {isCouple && tripSaldoData.length > 0 && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita x Gastos por viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tripSaldoData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="receita" fill="#00E676" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="gastos" fill="#FF5252" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comparação de gastos totais entre viagens */}
      {isCouple && tripBarData.length > 1 && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de gastos por viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tripBarData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="gastos" fill="#E91E8C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
