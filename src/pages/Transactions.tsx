import { useState, useEffect } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

type Category = { id: string; name: string; emoji: string; color: string; profile_id: string };
type Trip = { id: string; name: string; status: string };

export default function Transactions() {
  const { activeProfile, isCasal } = useProfile();
  const isCouple = isCasal;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recurrence, setRecurrence] = useState("once");
  const [categoryId, setCategoryId] = useState("");
  const [tripId, setTripId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProfile) return;
    supabase.from("categories").select("*").eq("profile_id", activeProfile.id).then(({ data }) => {
      setCategories(data || []);
      if (data && data.length > 0) setCategoryId(data[0].id);
    });
    if (isCouple) {
      supabase.from("trips").select("*").eq("status", "active").then(({ data }) => {
        setTrips(data || []);
        if (data && data.length > 0) setTripId(data[0].id);
      });
    }
  }, [activeProfile]);

  const handleSave = async () => {
    if (!activeProfile || !amount) return;
    setSaving(true);

    const { error } = await supabase.from("transactions").insert({
      profile_id: activeProfile.id,
      amount: parseFloat(amount),
      type,
      category_id: categoryId || null,
      description,
      date,
      recurrence: recurrence as "once" | "monthly" | "weekly",
      trip_id: isCouple && tripId ? tripId : null,
    });

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Lançamento salvo!");
      setAmount("");
      setDescription("");
    }
    setSaving(false);
  };

  if (!activeProfile) return null;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold">Novo Lançamento</h2>

      {/* Type selector */}
      <div className="flex gap-2">
        <Button
          variant={type === "expense" ? "default" : "outline"}
          onClick={() => setType("expense")}
          className={type === "expense" ? "bg-destructive hover:bg-destructive/90" : ""}
        >
          Despesa
        </Button>
        <Button
          variant={type === "income" ? "default" : "outline"}
          onClick={() => setType("income")}
          className={type === "income" ? "bg-success hover:bg-success/90" : ""}
        >
          Receita
        </Button>
      </div>

      {/* Amount */}
      <Card className="border-[0.5px]">
        <CardContent className="p-6">
          <label className="text-sm text-muted-foreground">Valor (R$)</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-3xl font-bold h-16 mt-2 border-none shadow-none text-center"
          />
        </CardContent>
      </Card>

      {/* Details */}
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Descrição</label>
          <Input
            placeholder="Ex: Almoço, Uber..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Data</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Recorrência</label>
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">Uma vez</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category chips */}
        <div>
          <label className="text-sm text-muted-foreground">Categoria</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  categoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Trip selector for couple */}
        {isCouple && (
          <div>
            <label className="text-sm text-muted-foreground">Período de viagem</label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar viagem" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving || !amount} className="w-full h-12 text-base">
        {saving ? "Salvando..." : "Salvar lançamento"}
      </Button>
    </div>
  );
}
