import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Lightbulb, ShieldCheck, Plane, CalendarDays } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Transaction = {
  amount: number;
  type: string;
  date: string;
  category_id: string | null;
  trip_id: string | null;
};

type Category = { id: string; name: string; emoji: string };
type Goal = { name: string; current_amount: number; target_amount: number; deadline: string | null };
type Installment = { installmentAmount: number; currentInstallment: number; totalInstallments: number };
type Investment = { investedAmount: number; currentAmount: number; type: string };
type Trip = { id: string; name: string; start_date: string; end_date: string; status: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function categoryMap(txns: Transaction[], categories: Category[]): Record<string, number> {
  const map: Record<string, number> = {};
  txns.filter((t) => t.type === "expense").forEach((t) => {
    const cat = categories.find((c) => c.id === t.category_id);
    const key = cat ? `${cat.emoji} ${cat.name}` : "Outros";
    map[key] = (map[key] || 0) + Number(t.amount);
  });
  return map;
}

// ─── Casal Analysis ───────────────────────────────────────────────────────────

function CasalAnalysis({
  transactions,
  categories,
  trips,
  investments,
  goals,
}: {
  transactions: Transaction[];
  categories: Category[];
  trips: Trip[];
  investments: Investment[];
  goals: Goal[];
}) {
  if (trips.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Plane className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Nenhuma viagem registrada ainda.</p>
        <p className="text-xs mt-1">Crie viagens em Configurações para ver as análises.</p>
      </div>
    );
  }

  const currentTrip = trips[0];
  const prevTrip = trips[1] ?? null;

  const curTxns = transactions.filter((t) => t.trip_id === currentTrip.id);
  const prevTxns = prevTrip ? transactions.filter((t) => t.trip_id === prevTrip.id) : [];

  const curIncome = curTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const curExpenses = curTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const curBalance = curIncome - curExpenses;

  const prevIncome = prevTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const prevExpenses = prevTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  void prevIncome;

  const tripDays = (t: Trip) =>
    Math.max(1, differenceInDays(new Date(t.end_date), new Date(t.start_date)) + 1);

  const curDays = tripDays(currentTrip);
  const prevDays = prevTrip ? tripDays(prevTrip) : 0;

  const curAvgDay = curExpenses / curDays;
  const prevAvgDay = prevDays > 0 ? prevExpenses / prevDays : 0;

  // ── Score ──────────────────────────────────────────────────────────────────
  let score = 50;
  if (curIncome > 0 && curExpenses < curIncome) score += 15;
  const savingsRate = curIncome > 0 ? ((curIncome - curExpenses) / curIncome) * 100 : 0;
  if (savingsRate >= 20) score += 10;
  else if (savingsRate >= 10) score += 5;
  else if (savingsRate < 0) score -= 15;
  if (prevAvgDay > 0 && curAvgDay < prevAvgDay) score += 10;
  if (investments.length > 0) score += 10;
  if (goals.some((g) => g.current_amount >= g.target_amount)) score += 5;
  score = Math.max(0, Math.min(100, score));

  // ── Category comparison ────────────────────────────────────────────────────
  const curByCat = categoryMap(curTxns, categories);
  const prevByCat = categoryMap(prevTxns, categories);
  const allCats = Array.from(new Set([...Object.keys(curByCat), ...Object.keys(prevByCat)]));

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights: { icon: string; text: string; type: "good" | "warn" | "info" }[] = [];

  // Avg per day
  insights.push({
    icon: "📅",
    text: `Média de gasto por dia nessa viagem: ${fmt(curAvgDay)}.`,
    type: "info",
  });

  // Compare avg/day with previous trip
  if (prevAvgDay > 0) {
    const diff = ((curAvgDay - prevAvgDay) / prevAvgDay) * 100;
    if (diff > 10) {
      insights.push({
        icon: "📈",
        text: `Média diária ${diff.toFixed(0)}% maior que a viagem anterior (${fmt(prevAvgDay)}/dia vs ${fmt(curAvgDay)}/dia).`,
        type: "warn",
      });
    } else if (diff < -10) {
      insights.push({
        icon: "📉",
        text: `Média diária ${Math.abs(diff).toFixed(0)}% menor que a viagem anterior — ótimo controle! (${fmt(prevAvgDay)}/dia → ${fmt(curAvgDay)}/dia).`,
        type: "good",
      });
    } else {
      insights.push({
        icon: "↔️",
        text: `Gasto diário similar à viagem anterior (${fmt(prevAvgDay)}/dia vs ${fmt(curAvgDay)}/dia).`,
        type: "info",
      });
    }
  }

  // Budget
  if (curIncome > 0) {
    const ratio = (curExpenses / curIncome) * 100;
    if (ratio > 90) {
      insights.push({
        icon: "⚠️",
        text: `Vocês usaram ${ratio.toFixed(0)}% do orçamento da viagem. Atenção ao saldo final.`,
        type: "warn",
      });
    } else if (ratio < 70) {
      insights.push({
        icon: "✅",
        text: `Vocês usaram apenas ${ratio.toFixed(0)}% do orçamento — ótimo controle!`,
        type: "good",
      });
    }
  }

  // Top category comparison with previous trip
  const topCurCat = Object.entries(curByCat).sort((a, b) => b[1] - a[1])[0];
  if (topCurCat) {
    const catName = topCurCat[0];
    const curVal = topCurCat[1];
    const prevVal = prevByCat[catName];
    if (prevVal) {
      const diff = ((curVal - prevVal) / prevVal) * 100;
      if (diff > 15) {
        insights.push({
          icon: "💸",
          text: `Vocês gastaram ${diff.toFixed(0)}% mais com "${catName}" nessa viagem (${fmt(prevVal)} → ${fmt(curVal)}).`,
          type: "warn",
        });
      } else if (diff < -15) {
        insights.push({
          icon: "🎉",
          text: `Vocês gastaram ${Math.abs(diff).toFixed(0)}% menos com "${catName}" nessa viagem (${fmt(prevVal)} → ${fmt(curVal)}).`,
          type: "good",
        });
      }
    } else {
      const pct = curIncome > 0 ? ((curVal / curIncome) * 100).toFixed(0) : null;
      insights.push({
        icon: "📊",
        text: `Maior gasto: "${catName}" com ${fmt(curVal)}${pct ? ` (${pct}% do orçamento)` : ""}.`,
        type: "info",
      });
    }
  }

  // Investments
  if (investments.length === 0) {
    insights.push({
      icon: "🏦",
      text: "Nenhum investimento registrado. Investir parte das economias de viagem é uma ótima estratégia.",
      type: "info",
    });
  }

  const curLabel = currentTrip.name;
  const prevLabel = prevTrip?.name ?? "";

  return (
    <div className="space-y-6">
      {/* Score */}
      <Card className="border-[0.5px]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Score de Saúde Financeira do Casal</span>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-extrabold ${scoreColor(score)}`}>{score}</span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
          </div>
          <Progress value={score} className="h-3 mb-2" />
          <p className={`text-sm font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Baseado em: saldo da viagem, gasto diário vs viagem anterior, investimentos e metas.
          </p>
        </CardContent>
      </Card>

      {/* Trip summary */}
      <Card className="border-[0.5px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plane className="h-4 w-4" /> Viagem atual — {currentTrip.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Receita</p>
              <p className="text-base font-bold text-emerald-500">{fmt(curIncome)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Gastos</p>
              <p className="text-base font-bold text-rose-500">{fmt(curExpenses)}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${curBalance >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              <p className="text-xs text-muted-foreground mb-1">Saldo</p>
              <p className={`text-base font-bold ${curBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {curBalance >= 0 ? "+" : ""}{fmt(curBalance)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <CalendarDays className="h-3 w-3" /> Média/dia
              </p>
              <p className="text-base font-bold">{fmt(curAvgDay)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {curDays} dia{curDays !== 1 ? "s" : ""} ·{" "}
            {format(new Date(currentTrip.start_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} →{" "}
            {format(new Date(currentTrip.end_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </CardContent>
      </Card>

      {/* Previous trip comparison */}
      {prevTrip && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Comparativo — {curLabel} vs {prevLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
              <div />
              <div className="font-semibold text-primary">{curLabel}</div>
              <div className="text-muted-foreground">{prevLabel}</div>
            </div>
            {[
              { label: "Total gasto", cur: curExpenses, prev: prevExpenses },
              { label: "Média/dia", cur: curAvgDay, prev: prevAvgDay },
              { label: "Duração (dias)", cur: curDays, prev: prevDays, raw: true },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-2 items-center py-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-sm font-semibold text-center text-primary">
                  {row.raw ? row.cur : fmt(row.cur)}
                </span>
                <span className="text-sm text-muted-foreground text-center">
                  {row.raw ? row.prev : fmt(row.prev)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <Card className="border-[0.5px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> Insights automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((ins, i) => (
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
          ))}
        </CardContent>
      </Card>

      {/* Category comparison */}
      {allCats.length > 0 && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos por categoria — {curLabel}{prevTrip ? ` vs ${prevLabel}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allCats
              .sort((a, b) => (curByCat[b] || 0) - (curByCat[a] || 0))
              .map((cat) => {
                const cur = curByCat[cat] || 0;
                const prev = prevByCat[cat] || 0;
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
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(cur / maxVal) * 100}%` }} />
                    </div>
                    {prev > 0 && (
                      <div className="flex gap-1 items-center">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-muted-foreground/40 transition-all" style={{ width: `${(prev / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-1">{fmt(prev)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-primary/70 inline-block" />{curLabel}</span>
              {prevTrip && <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-muted-foreground/40 inline-block" />{prevLabel}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All trips avg/day */}
      {trips.length > 1 && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Média diária por viagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trips.map((trip) => {
              const txns = transactions.filter((t) => t.trip_id === trip.id);
              const exp = txns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              const days = Math.max(1, differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1);
              const avg = exp / days;
              const maxAvg = trips.reduce((max, tr) => {
                const e = transactions.filter((t) => t.trip_id === tr.id && t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
                const d = Math.max(1, differenceInDays(new Date(tr.end_date), new Date(tr.start_date)) + 1);
                return Math.max(max, e / d);
              }, 1);
              return (
                <div key={trip.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{trip.name}</span>
                    <span className="text-muted-foreground">{fmt(avg)}/dia · {days}d</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${(avg / maxAvg) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Individual Analysis ───────────────────────────────────────────────────────

function IndividualAnalysis({
  transactions,
  categories,
  goals,
  investments,
  activeProfileId,
}: {
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  investments: Investment[];
  activeProfileId: string;
}) {
  const installments = loadLS<Installment>(`installments_${activeProfileId}`);

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
  void prevIncome;

  const activeInstallments = installments.filter((i) => i.currentInstallment <= i.totalInstallments);
  const monthlyInstallmentBurden = activeInstallments.reduce((s, i) => s + i.installmentAmount, 0);

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentAmount, 0);
  const investYield = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

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

  const curByCat = categoryMap(curTxns, categories);
  const prevByCat = categoryMap(prevTxns, categories);
  const allCats = Array.from(new Set([...Object.keys(curByCat), ...Object.keys(prevByCat)]));

  const insights: { icon: string; text: string; type: "good" | "warn" | "info" }[] = [];

  if (curIncome > 0) {
    const expRatio = (curExpenses / curIncome) * 100;
    if (expRatio > 90) insights.push({ icon: "⚠️", text: `Você gastou ${expRatio.toFixed(0)}% da sua renda este mês. Tente reduzir para abaixo de 80%.`, type: "warn" });
    else if (expRatio < 70) insights.push({ icon: "✅", text: `Você gastou apenas ${expRatio.toFixed(0)}% da sua renda — ótimo controle!`, type: "good" });
  }

  const topCat = Object.entries(curByCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat && curIncome > 0) {
    const pct = ((topCat[1] / curIncome) * 100).toFixed(0);
    insights.push({ icon: "📊", text: `Sua maior despesa é "${topCat[0]}" com ${fmt(topCat[1])} (${pct}% da renda).`, type: "info" });
  }

  if (prevExpenses > 0) {
    const diff = ((curExpenses - prevExpenses) / prevExpenses) * 100;
    if (diff > 15) insights.push({ icon: "📈", text: `Seus gastos aumentaram ${diff.toFixed(0)}% em relação ao mês anterior (${fmt(prevExpenses)} → ${fmt(curExpenses)}).`, type: "warn" });
    else if (diff < -10) insights.push({ icon: "📉", text: `Seus gastos caíram ${Math.abs(diff).toFixed(0)}% em relação ao mês anterior. Continue assim!`, type: "good" });
  }

  if (installmentRatio > 0) {
    const tip = installmentRatio > 30
      ? { icon: "💳", text: `Parcelas comprometem ${installmentRatio.toFixed(0)}% da sua renda. O ideal é até 30%.`, type: "warn" as const }
      : { icon: "💳", text: `Parcelas comprometem ${installmentRatio.toFixed(0)}% da sua renda — dentro do limite recomendado.`, type: "good" as const };
    insights.push(tip);
  }

  if (investments.length === 0) {
    insights.push({ icon: "🏦", text: "Você não tem investimentos registrados. Investir, mesmo que pouco, faz diferença no longo prazo.", type: "info" });
  } else if (investYield > 0) {
    insights.push({ icon: "📈", text: `Seus investimentos renderam ${investYield.toFixed(2)}% — equivalente a ${fmt(totalCurrent - totalInvested)}.`, type: "good" });
  }

  const nearGoal = goals.find((g) => g.current_amount < g.target_amount && g.target_amount > 0 && (g.current_amount / g.target_amount) >= 0.7);
  if (nearGoal) {
    const pct = ((nearGoal.current_amount / nearGoal.target_amount) * 100).toFixed(0);
    insights.push({ icon: "🎯", text: `Você está ${pct}% do caminho para a meta "${nearGoal.name}". Faltam ${fmt(nearGoal.target_amount - nearGoal.current_amount)}.`, type: "good" });
  }

  const curMonthLabel = format(now, "MMMM", { locale: ptBR });
  const prevMonthLabel = format(prevMonth, "MMMM", { locale: ptBR });

  return (
    <div className="space-y-6">
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
              .sort((a, b) => (curByCat[b] || 0) - (curByCat[a] || 0))
              .map((cat) => {
                const cur = curByCat[cat] || 0;
                const prev = prevByCat[cat] || 0;
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
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(cur / maxVal) * 100}%` }} />
                    </div>
                    {prev > 0 && (
                      <div className="flex gap-1 items-center">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-muted-foreground/40 transition-all" style={{ width: `${(prev / maxVal) * 100}%` }} />
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

      {/* Tips */}
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

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Analysis() {
  const { activeProfile, isCasal } = useProfile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile) return;
    const load = async () => {
      const { data: txns } = await supabase
        .from("transactions")
        .select("amount,type,date,category_id,trip_id")
        .eq("profile_id", activeProfile.id);
      const { data: cats } = await supabase
        .from("categories").select("id,name,emoji").eq("profile_id", activeProfile.id);
      const { data: gs } = await supabase
        .from("goals").select("name,current_amount,target_amount,deadline").eq("profile_id", activeProfile.id);

      setTransactions(txns || []);
      setCategories(cats || []);
      setGoals(gs || []);

      if (isCasal) {
        const { data: tripsData } = await supabase
          .from("trips").select("*").order("start_date", { ascending: false });
        setTrips(tripsData || []);
      }

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

  const investments = loadLS<Investment>(`investments_${activeProfile.id}`);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Análises e Dicas</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isCasal ? "Baseado nas viagens do casal" : "Baseado nos seus dados reais"}
        </p>
      </div>

      {isCasal ? (
        <CasalAnalysis
          transactions={transactions}
          categories={categories}
          trips={trips}
          investments={investments}
          goals={goals}
        />
      ) : (
        <IndividualAnalysis
          transactions={transactions}
          categories={categories}
          goals={goals}
          investments={investments}
          activeProfileId={activeProfile.id}
        />
      )}
    </div>
  );
}
