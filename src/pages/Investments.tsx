import { useState, useEffect } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type InvestmentType = "renda_fixa" | "acoes" | "cripto" | "fundos" | "previdencia" | "outros";

type Investment = {
  id: string;
  name: string;
  investedAmount: number;
  currentAmount: number;
  startDate: string;
  type: InvestmentType;
};

const TYPES: Record<InvestmentType, string> = {
  renda_fixa: "Renda Fixa",
  acoes: "Ações",
  cripto: "Cripto",
  fundos: "Fundos",
  previdencia: "Previdência",
  outros: "Outros",
};

const TYPE_EMOJI: Record<InvestmentType, string> = {
  renda_fixa: "🏦",
  acoes: "📈",
  cripto: "₿",
  fundos: "📊",
  previdencia: "🏛️",
  outros: "💼",
};

function storageKey(profileId: string) {
  return `investments_${profileId}`;
}

function loadInvestments(profileId: string): Investment[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId)) || "[]");
  } catch {
    return [];
  }
}

function saveInvestments(profileId: string, data: Investment[]) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(data));
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export default function Investments() {
  const { activeProfile } = useProfile();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [type, setType] = useState<InvestmentType>("renda_fixa");

  useEffect(() => {
    if (!activeProfile) return;
    setInvestments(loadInvestments(activeProfile.id));
  }, [activeProfile]);

  if (!activeProfile) return null;

  const resetForm = () => {
    setName(""); setInvestedAmount(""); setCurrentAmount("");
    setStartDate(format(new Date(), "yyyy-MM-dd")); setType("renda_fixa");
    setEditId(null);
  };

  const handleSave = () => {
    if (!name || !investedAmount || !currentAmount) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    let updated: Investment[];
    if (editId) {
      updated = investments.map((i) =>
        i.id === editId
          ? { ...i, name, investedAmount: parseFloat(investedAmount), currentAmount: parseFloat(currentAmount), startDate, type }
          : i
      );
      toast.success("Investimento atualizado!");
    } else {
      const item: Investment = {
        id: crypto.randomUUID(),
        name,
        investedAmount: parseFloat(investedAmount),
        currentAmount: parseFloat(currentAmount),
        startDate,
        type,
      };
      updated = [...investments, item];
      toast.success("Investimento adicionado!");
    }
    saveInvestments(activeProfile.id, updated);
    setInvestments(updated);
    setOpen(false);
    resetForm();
  };

  const handleEdit = (item: Investment) => {
    setEditId(item.id);
    setName(item.name);
    setInvestedAmount(String(item.investedAmount));
    setCurrentAmount(String(item.currentAmount));
    setStartDate(item.startDate);
    setType(item.type);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    const updated = investments.filter((i) => i.id !== id);
    saveInvestments(activeProfile.id, updated);
    setInvestments(updated);
    toast.success("Removido.");
  };

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentAmount, 0);
  const totalYieldR = totalCurrent - totalInvested;
  const totalYieldPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  // Group by type for overview
  const byType = Object.entries(
    investments.reduce<Record<string, number>>((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + i.currentAmount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Investimentos</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Investimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome (ex: CDB Nubank)" value={name} onChange={(e) => setName(e.target.value)} />
              <Select value={type} onValueChange={(v) => setType(v as InvestmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPES) as [InvestmentType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{TYPE_EMOJI[v]} {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor investido (R$) *</label>
                  <Input type="number" placeholder="0,00" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor atual (R$) *</label>
                  <Input type="number" placeholder="0,00" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data de início</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleSave} className="w-full" disabled={!name || !investedAmount || !currentAmount}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary card */}
      <Card className="border-[0.5px] bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visão geral</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Total investido</p>
              <p className="text-lg font-bold">{fmt(totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor atual</p>
              <p className="text-lg font-bold">{fmt(totalCurrent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rendimento R$</p>
              <p className={`text-lg font-bold ${totalYieldR >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {totalYieldR >= 0 ? "+" : ""}{fmt(totalYieldR)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rendimento %</p>
              <p className={`text-lg font-bold ${totalYieldPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {fmtPct(totalYieldPct)}
              </p>
            </div>
          </div>
          {byType.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {byType.map(([t, v]) => (
                <span key={t} className="text-xs bg-background border border-[0.5px] rounded-full px-2.5 py-1">
                  {TYPE_EMOJI[t as InvestmentType]} {TYPES[t as InvestmentType]}: {fmt(v)}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {investments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Landmark className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum investimento registrado.</p>
          <p className="text-xs mt-1">Adicione seus investimentos para acompanhar o rendimento.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {investments.map((item) => {
            const yieldR = item.currentAmount - item.investedAmount;
            const yieldPct = item.investedAmount > 0 ? ((item.currentAmount - item.investedAmount) / item.investedAmount) * 100 : 0;
            const positive = yieldR >= 0;
            return (
              <Card key={item.id} className="border-[0.5px]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{TYPE_EMOJI[item.type]}</span>
                        <p className="font-semibold truncate">{item.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {TYPES[item.type]} · desde {format(new Date(item.startDate + "T12:00:00"), "MM/yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleEdit(item)}>
                        Editar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Investido</p>
                      <p className="text-sm font-semibold">{fmt(item.investedAmount)}</p>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Atual</p>
                      <p className="text-sm font-semibold">{fmt(item.currentAmount)}</p>
                    </div>
                    <div className={`rounded p-2 ${positive ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                      <p className="text-xs text-muted-foreground">Rendimento</p>
                      <p className={`text-sm font-bold flex items-center justify-center gap-0.5 ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {fmtPct(yieldPct)}
                      </p>
                      <p className={`text-xs ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                        {positive ? "+" : ""}{fmt(yieldR)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
