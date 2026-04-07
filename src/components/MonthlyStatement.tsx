import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  date: string;
  category_id: string | null;
};

type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

type Props = {
  month: Date;
  transactions: Transaction[];
  categories: Category[];
  profileId: string;
  onClose: () => void;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function paidKey(profileId: string, year: number, month: number) {
  return `grana_paid_${profileId}_${year}_${month}`;
}

function loadPaid(profileId: string, year: number, month: number): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(paidKey(profileId, year, month)) || "[]");
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function savePaid(profileId: string, year: number, month: number, paid: Set<string>) {
  localStorage.setItem(paidKey(profileId, year, month), JSON.stringify([...paid]));
}

export function MonthlyStatement({ month, transactions, categories, profileId, onClose }: Props) {
  const year = month.getFullYear();
  const monthNum = month.getMonth() + 1;

  const [paid, setPaid] = useState<Set<string>>(() => loadPaid(profileId, year, monthNum));

  const monthLabel = format(month, "MMMM yyyy", { locale: ptBR });
  const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  const togglePaid = (id: string) => {
    setPaid((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePaid(profileId, year, monthNum, next);
      return next;
    });
  };

  const getCat = (categoryId: string | null) => categories.find((c) => c.id === categoryId);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-bold text-lg truncate">Extrato — {capitalized}</h2>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6 pb-24">
        {/* Summary cards */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[0.5px] bg-emerald-500/10 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Receitas
              </p>
              <p className="text-xl font-bold text-emerald-500">{fmt(totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-[0.5px] bg-rose-500/10 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3 text-rose-500" /> Despesas
              </p>
              <p className="text-xl font-bold text-rose-500">{fmt(totalExpenses)}</p>
            </div>
          </div>
          <div
            className={`rounded-xl p-4 text-center ${
              balance >= 0
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-rose-500/10 border border-rose-500/20"
            }`}
          >
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
              <Wallet className="h-3 w-3" /> Saldo do mês
            </p>
            <p className={`text-2xl font-extrabold ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {balance >= 0 ? "+" : ""}{fmt(balance)}
            </p>
          </div>
        </div>

        {/* Income section */}
        {income.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Receitas</h3>
              <span className="text-sm font-bold text-emerald-500">{fmt(totalIncome)}</span>
            </div>
            <div className="rounded-xl border border-[0.5px] overflow-hidden divide-y divide-border">
              {income.map((t) => {
                const cat = getCat(t.category_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-background">
                    <span className="text-xl shrink-0">{cat?.emoji || "💰"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.description || cat?.name || "Receita"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.date + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-500 shrink-0">
                      +{fmt(Number(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expenses section */}
        {expenses.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Despesas</h3>
              <span className="text-sm font-bold text-rose-500">{fmt(totalExpenses)}</span>
            </div>
            <div className="rounded-xl border border-[0.5px] overflow-hidden divide-y divide-border">
              {expenses.map((t) => {
                const cat = getCat(t.category_id);
                const isPaid = paid.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 bg-background transition-opacity ${isPaid ? "opacity-60" : ""}`}
                  >
                    <button
                      onClick={() => togglePaid(t.id)}
                      className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                      aria-label={isPaid ? "Marcar como não pago" : "Marcar como pago"}
                    >
                      {isPaid ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <span className="text-xl shrink-0">{cat?.emoji || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isPaid ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {t.description || cat?.name || "Despesa"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.date + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold shrink-0 ${
                        isPaid ? "text-muted-foreground line-through" : "text-rose-500"
                      }`}
                    >
                      -{fmt(Number(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {income.length === 0 && expenses.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma transação encontrada neste mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}
