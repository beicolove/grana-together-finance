import { useState, useEffect } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
  description: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  current_installment: number;
  start_date: string;
  category: string;
  profile_id: string;
};

const CATEGORIES = [
  "Eletrônicos", "Eletrodomésticos", "Móveis", "Vestuário",
  "Saúde", "Educação", "Viagem", "Automóvel", "Outros",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Installments() {
  const { activeProfile } = useProfile();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("Outros");

  const resetForm = () => {
    setDescription(""); setTotalAmount(""); setInstallmentAmount("");
    setTotalInstallments(""); setCurrentInstallment("1");
    setStartDate(format(new Date(), "yyyy-MM-dd")); setCategory("Outros");
  };

  useEffect(() => {
    if (!activeProfile) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar parcelamentos.");
      setInstallments(data || []);
      setLoading(false);
    };
    load();
  }, [activeProfile]);

  if (!activeProfile) return null;

  const handleAdd = async () => {
    if (!description || !installmentAmount || !totalInstallments) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setSaving(true);
    const total = parseFloat(totalAmount) || parseFloat(installmentAmount) * parseInt(totalInstallments);
    const { data, error } = await supabase
      .from("installments")
      .insert({
        profile_id: activeProfile.id,
        description,
        total_amount: total,
        installment_amount: parseFloat(installmentAmount),
        total_installments: parseInt(totalInstallments),
        current_installment: parseInt(currentInstallment),
        start_date: startDate,
        category,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    setInstallments((prev) => [data, ...prev]);
    toast.success("Parcelamento adicionado!");
    setOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("installments").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    setInstallments((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removido.");
  };

  const handleAdvance = async (item: Installment) => {
    const next = Math.min(item.current_installment + 1, item.total_installments + 1);
    const { error } = await supabase
      .from("installments")
      .update({ current_installment: next })
      .eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    setInstallments((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, current_installment: next } : i))
    );
  };

  const active = installments.filter((i) => i.current_installment <= i.total_installments);
  const finished = installments.filter((i) => i.current_installment > i.total_installments);
  const monthlyCommitment = active.reduce((s, i) => s + i.installment_amount, 0);

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
              <Input placeholder="Nome (ex: iPhone 15)" value={description} onChange={(e) => setDescription(e.target.value)} />
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
              <Button onClick={handleAdd} className="w-full" disabled={!description || !installmentAmount || !totalInstallments || saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
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

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : installments.length === 0 ? (
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
                  const paid = item.current_installment - 1;
                  const pct = (paid / item.total_installments) * 100;
                  return (
                    <Card key={item.id} className="border-[0.5px]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.category} · iniciado em {format(new Date(item.start_date + "T12:00:00"), "MM/yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleAdvance(item)}>
                              +1
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-rose-500">{fmt(item.installment_amount)}/mês</span>
                          <span className="text-muted-foreground font-medium">{paid}/{item.total_installments} pagas</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.round(pct)}% pago</span>
                          <span>Total: {fmt(item.total_amount || item.installment_amount * item.total_installments)}</span>
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
                        <p className="font-semibold truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.total_installments}x {fmt(item.installment_amount)} · {item.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-emerald-500">Quitado</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={() => handleDelete(item.id)}>
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
