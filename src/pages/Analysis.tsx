import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Lightbulb, ShieldCheck } from "lucide-react";

type Transaction = { amount: number; type: string; date: string; category_id: string | null };
type Category = { id: string; name: string; emoji: string };
type Goal = { name: string; current_amount: number; target_amount: number; deadline: string | null };

type Installment = { installmentAmount: number; currentInstallment: number; totalInstallments: number };
type Investment = { investedAmount: number; currentAmount: number };

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function loadLS<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function scoreColor(s: number) {
  if (s >= 75) return "text-emerald-500";
  if (s >= 50) return "text-amber-500";
  return "text-rose-500";
}
function scoreLabel(s: number) {
  if (s >= 80) return "Excelente";
  if (s >= 65) return "Bom";
  if (s >= 45) return "Regular";
  return "Atenção";
}

export default function Analysis() {
  const { activeProfile } = useProfile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile) return;
    const load = async () => {
      const { data: txns } = await supabase
        .from("transactions").select("amount,type,date,category_id")
        .eq("profile_id", activeProfile.id);
      const { data: cats } = await supabase
        .from("categories").select("id,name,emoji").eq("profile_id", activeProfile.id);
      const { data: gs } = await supabase
        .from("goals").select("name,current_amount,target_amount,deadline").eq("profile_id", activeProfile.id);
      setTransactions(txns || []);
      setCategories(cats || []);
      setGoals(gs || []);
      setLoading(false);
    };
    load();
  }, [activeProfile]);

  if (!activeProfile || loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Carregando análise...
      </div>
    );
  }

  const now = new Date();
  const curStart = format(startOfMonth(now), "yyyy-MM-dd");
  const curEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const prevMonth = subMonths(now, 1);
  const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const curTxns = transactions.filter((t) => t.date >= curStart && t.date <= curEnd);
  const prevTxns = transactions.filter((t) => t.date >= prevStart && t.date <= prevEnd);

  const curIncome = curTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const curExpenses = curTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const prevIncome = prevTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const prevExpenses = prevTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const installments = loadLS<Installment>(`installments_${activeProfile.id}`);
  const investments = loadLS<Investment>(`investments_${activeProfile.id}`);
  const activeInstallments = installments.filter((i) => i.currentInstallment <= i.totalInstallments);
  const monthlyInstallmentBurden = activeInstallments.reduce((s, i) => s + i.installmentAmount, 0);

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentAmount, 0);
  const investYield = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  // ── Score ─────────────────────────────────────────────────────────────────
  let score = 50;
  const savingsRate = curIncome > 0 ? ((curIncome - curExpenses) / curIncome) * 100 : 0;
  if (curIncome > 0 && curExpenses < curIncome) score += 10;
  if (savingsRate >= 20) score += 20;
  else if (savingsRate >= 10) score += 10;
  else if (savingsRate < 0) score -= 15;

  const installmentRatio = curIncome > 0 ? (monthlyInstallmentBurden / curIncome) * 100 : 0;
  if (installmentRatio > 30) score -= 15;
  else if (installmentRatio > 15) score -= 5;

  if (investments.length > 0) score += 10;
  const investTypes = new Set(investments.map((i: any) => i.type)).size;
  if (investTypes >= 3) score += 5;
  else if (investTypes >= 2) score += 2;

  const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount).length;
  if (completedGoals > 0) score += 5;

  score = Math.max(0, Math.min(100, score));

  // ── Category breakdown ─────────────────────────────────────────────────────
  function expByCategory(txns: Transaction[]) {
    const map: Record<string, number> = {};
    txns.filter((t) => t.type === "expense").forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const key = cat ? `${cat.emoji} ${cat.name}` : "Outros";
      map[key] = (map[key] || 0) + Number(t.amount);
    });
    return map;
  }

  const curByCategory = expByCategory(curTxns);
  const prevByCategory = expByCategory(prevTxns);
  const allCats = Array.from(new Set([...Object.keys(curByCategory), ...Object.keys(prevByCategory)]));

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights: { icon: string; text: string; type: "good" | "warn" | "info" }[] = [];

  // Expense ratio
  if (curIncome > 0) {
    const expRatio = (curExpenses / curIncome) * 100;
    if (expRatio > 90) insights.push({ icon: "⚠️", text: `Você gastou ${expRatio.toFixed(0)}% da sua renda este mês. Tente reduzir para abaixo de 80%.`, type: "warn" });
    else if (expRatio < 70) insights.push({ icon: "✅", text: `Você gastou apenas ${expRatio.toFixed(0)}% da sua renda — ótimo controle!`, type: "good" });
  }

  // Biggest category
  const topCat = Object.entries(curByCategory).sort((a, b) => b[1] - a[1])[0];
  if (topCat && curIncome > 0) {
    const pct = ((topCat[1] / curIncome) * 100).toFixed(0);
    insights.push({ icon: "📊", text: `Sua maior despesa é "${topCat[0]}" com ${fmt(topCat[1])} (${pct}% da renda).`, type: "info" });
  }

  // Month comparison
  if (prevExpenses > 0) {
    const diff = ((curExpenses - prevExpenses) / prevExpenses) * 100;
    if (diff > 15) insights.push({ icon: "📈", text: `Seus gastos aumentaram ${diff.toFixed(0)}% em relação ao mês anterior (${fmt(prevExpenses)} → ${fmt(curExpenses)}).`, type: "warn" });
    else if (diff < -10) insights.push({ icon: "📉", text: `Seus gastos caíram ${Math.abs(diff).toFixed(0)}% em relação ao mês anterior. Continue assim!`, type: "good" });
  }

  // Installments
  if (installmentRatio > 0) {
    const tip = installmentRatio > 30
      ? { icon: "💳", text: `Parcelas comprometem ${installmentRatio.toFixed(0)}% da sua renda. O ideal é até 30%.`, type: "warn" as const }
      : { icon: "💳", text: `Parcelas comprometem ${installmentRatio.toFixed(0)}% da sua renda — dentro do limite recomendado.`, type: "good" as const };
    insights.push(tip);
  }

  // Investments
  if (investments.length === 0) {
    insights.push({ icon: "🏦", text: "Você não tem investimentos registrados. Investir, mesmo que pouco, faz diferença no longo prazo.", type: "info" });
  } else if (investYield > 0) {
    insights.push({ icon: "📈", text: `Seus investimentos renderam ${investYield.toFixed(2)}% — equivalente a ${fmt(totalCurrent - totalInvested)}.`, type: "good" });
  }

  // Goals
  const nearGoal = goals.find((g) => g.current_amount < g.target_amount && g.target_amount > 0 && (g.current_amount / g.target_amount) >= 0.7);
  if (nearGoal) {
    const pct = ((nearGoal.current_amount / nearGoal.target_amount) * 100).toFixed(0);
    insights.push({ icon: "🎯", text: `Você está ${pct}% do caminho para a meta "${nearGoal.name}". Faltam ${fmt(nearGoal.target_amount - nearGoal.current_amount)}.`, type: "good" });
  }

  const curMonthLabel = format(now, "MMMM", { locale: ptBR });
  const prevMonthLabel = format(prevMonth, "MMMM", { locale: ptBR });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Análises e Dicas</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Baseado nos seus dados reais</p>
      </div>

      {/* Score */}
      <Card className="border-[0.5px]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Score de Saúde Financeira</span>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-extrabold ${scoreColor(score)}`}>{score}</span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
          </div>
          <Progress value={score} className="h-3 mb-2" />
          <p className={`text-sm font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Calculado com base em: taxa de poupança, comprometimento de renda, investimentos e metas.
          </p>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="border-[0.5px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> Insights automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Adicione transações para gerar insights.</p>
          ) : (
            insights.slice(0, 6).map((ins, i) => (
              <div
                key={i}
                className={`flex gap-3 rounded-lg p-3 text-sm ${
                  ins.type === "good"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : ins.type === "warn"
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-muted/50 border border-border"
                }`}
              >
                <span className="text-base shrink-0">{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Category comparison */}
      {allCats.length > 0 && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos por categoria — {curMonthLabel} vs {prevMonthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allCats
              .sort((a, b) => (curByCategory[b] || 0) - (curByCategory[a] || 0))
              .map((cat) => {
                const cur = curByCategory[cat] || 0;
                const prev = prevByCategory[cat] || 0;
                const diff = prev > 0 ? ((cur - prev) / prev) * 100 : null;
                const maxVal = Math.max(cur, prev, 1);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{cat}</span>
                      <div className="flex items-center gap-2">
                        {diff !== null && (
                          <span className={`flex items-center gap-0.5 ${diff > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(diff).toFixed(0)}%
                          </span>
                        )}
                        <span className="text-muted-foreground">{fmt(cur)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${(cur / maxVal) * 100}%` }}
                        />
                      </div>
                    </div>
                    {prev > 0 && (
                      <div className="flex gap-1 items-center">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-muted-foreground/40 transition-all"
                            style={{ width: `${(prev / maxVal) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-1">{fmt(prev)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-primary/70 inline-block" />{curMonthLabel}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-muted-foreground/40 inline-block" />{prevMonthLabel}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips based on top spending */}
      {topCat && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Dicas personalizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(() => {
              const tips: string[] = [];
              const catName = topCat[0].toLowerCase();
              if (catName.includes("alimenta")) tips.push("Experimente planejar refeições semanalmente — pode reduzir gastos com alimentação em até 25%.");
              if (catName.includes("transport") || catName.includes("carro") || catName.includes("uber")) tips.push("Considere combinar transporte por aplicativo com transporte público para reduzir custos de deslocamento.");
              if (catName.includes("lazer") || catName.includes("entreten")) tips.push("Busque opções gratuitas ou de baixo custo para lazer nos finais de semana.");
              if (savingsRate < 10 && curIncome > 0) tips.push("Tente poupar pelo menos 10% da sua renda todo mês — automatize a transferência no dia do pagamento.");
              if (activeInstallments.length > 3) tips.push("Evite novas compras parceladas até quitar pelo menos metade dos parcelamentos ativos.");
              if (investments.length === 0) tips.push("Mesmo R$ 50/mês em renda fixa já é um começo. O hábito de investir importa mais do que o valor.");
              if (tips.length === 0) tips.push("Continue monitorando seus gastos mensalmente — a consistência é a chave das finanças saudáveis.");
              return tips.slice(0, 3).map((tip, i) => (
                <div key={i} className="flex gap-2 text-muted-foreground">
                  <span className="text-primary mt-0.5">›</span>
                  <span>{tip}</span>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
