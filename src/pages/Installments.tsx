import { useState, useEffect } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CreditCard, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Installment = {
  id: string;
  name: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  currentInstallment: number;
  startDate: string;
  category: string;
};

const CATEGORIES = [
  "Eletrônicos", "Eletrodomésticos", "Móveis", "Vestuário",
  "Saúde", "Educação", "Viagem", "Automóvel", "Outros",
];

function storageKey(profileId: string) {
  return `installments_${profileId}`;
}

function loadInstallments(profileId: string): Installment[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId)) || "[]");
  } catch {
    return [];
  }
}

function saveInstallments(profileId: string, data: Installment[]) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(data));
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Installments() {
  const { activeProfile } = useProfile();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [open, setOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("Outros");

  useEffect(() => {
    if (!activeProfile) return;
    setInstallments(loadInstallments(activeProfile.id));
  }, [activeProfile]);

  if (!activeProfile) return null;

  const handleAdd = () => {
    if (!name || !installmentAmount || !totalInstallments) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const total = parseFloat(totalAmount) || parseFloat(installmentAmount) * parseInt(totalInstallments);
    const item: Installment = {
      id: crypto.randomUUID(),
      name,
      totalAmount: total,
      installmentAmount: parseFloat(installmentAmount),
      totalInstallments: parseInt(totalInstallments),
      currentInstallment: parseInt(currentInstallment),
      startDate,
      category,
    };
    const updated = [...installments, item];
    saveInstallments(activeProfile.id, updated);
    setInstallments(updated);
    toast.success("Parcelamento adicionado!");
    setOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = installments.filter((i) => i.id !== id);
    saveInstallments(activeProfile.id, updated);
    setInstallments(updated);
    toast.success("Removido.");
  };

  const handleAdvance = (id: string) => {
    const updated = installments.map((i) => {
      if (i.id !== id) return i;
      const next = Math.min(i.currentInstallment + 1, i.totalInstallments);
      return { ...i, currentInstallment: next };
    });
    saveInstallments(activeProfile.id, updated);
    setInstallments(updated);
  };

  const resetForm = () => {
    setName(""); setTotalAmount(""); setInstallmentAmount("");
    setTotalInstallments(""); setCurrentInstallment("1");
    setStartDate(format(new Date(), "yyyy-MM-dd")); setCategory("Outros");
  };

  const monthlyCommitment = installments
    .filter((i) => i.currentInstallment <= i.totalInstallments)
    .reduce((s, i) => s + i.installmentAmount, 0);

  const active = installments.filter((i) => i.currentInstallment <= i.totalInstallments);
  const finished = installments.filter((i) => i.currentInstallment > i.totalInstallments);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Parcelamentos</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Parcelamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome (ex: iPhone 15)" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor total (R$)</label>
                  <Input type="number" placeholder="0,00" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor da parcela (R$) *</label>
                  <Input type="number" placeholder="0,00" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Total de parcelas *</label>
                  <Input type="number" min="1" placeholder="12" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Parcela atual</label>
                  <Input type="number" min="1" placeholder="1" value={currentInstallment} onChange={(e) => setCurrentInstallment(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data de início</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} className="w-full" disabled={!name || !installmentAmount || !totalInstallments}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary card */}
      <Card className="border-[0.5px] bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Compromisso mensal</p>
            <p className="text-2xl font-extrabold text-rose-500">{fmt(monthlyCommitment)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{active.length} parcelamento{active.length !== 1 ? "s" : ""} ativo{active.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-xl font-bold">{active.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Concluídos</p>
              <p className="text-xl font-bold text-emerald-500">{finished.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {installments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum parcelamento registrado.</p>
          <p className="text-xs mt-1">Adicione compras parceladas para acompanhar o progresso.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ativos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {active.map((item) => {
                  const paid = item.currentInstallment - 1;
                  const pct = (paid / item.totalInstallments) * 100;
                  return (
                    <Card key={item.id} className="border-[0.5px]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category} · iniciado em {format(new Date(item.startDate + "T12:00:00"), "MM/yyyy")}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleAdvance(item.id)}
                              disabled={item.currentInstallment > item.totalInstallments}
                            >
                              +1
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

                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-rose-500">{fmt(item.installmentAmount)}/mês</span>
                          <span className="text-muted-foreground font-medium">
                            {paid}/{item.totalInstallments} pagas
                          </span>
                        </div>

                        <Progress value={pct} className="h-2" />

                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.round(pct)}% pago</span>
                          <span>Total: {fmt(item.totalAmount || item.installmentAmount * item.totalInstallments)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {finished.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Concluídos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {finished.map((item) => (
                  <Card key={item.id} className="border-[0.5px] opacity-60">
                    <CardContent className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.totalInstallments}x {fmt(item.installmentAmount)} · {item.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-emerald-500">Quitado</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
