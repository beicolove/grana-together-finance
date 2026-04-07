import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Goal = {
  id: string;
  name: string;
  emoji: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  trip_id: string | null;
};
type Trip = { id: string; name: string };

export default function Goals() {
  const { activeProfile, isCasal } = useProfile();
  const isCouple = isCasal;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tripId, setTripId] = useState("");

  // Contribuição inline
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);
  const [contribValue, setContribValue] = useState("");
  const [contribSaving, setContribSaving] = useState(false);

  const load = async () => {
    if (!activeProfile) return;
    const { data } = await supabase.from("goals").select("*").eq("profile_id", activeProfile.id).order("created_at");
    setGoals(data || []);
    if (isCouple) {
      const { data: t } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      setTrips(t || []);
    }
  };

  useEffect(() => { load(); }, [activeProfile]);

  const handleAdd = async () => {
    if (!activeProfile || !name || !targetAmount) return;
    const { error } = await supabase.from("goals").insert({
      profile_id: activeProfile.id,
      name,
      emoji,
      target_amount: parseFloat(targetAmount),
      deadline: deadline || null,
      trip_id: isCouple && tripId ? tripId : null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Meta criada!");
      setOpen(false);
      setName(""); setEmoji("🎯"); setTargetAmount(""); setDeadline(""); setTripId("");
      load();
    }
  };

  const handleContrib = async (goal: Goal) => {
    const value = parseFloat(contribValue);
    if (!value || value <= 0) return;
    setContribSaving(true);
    const newAmount = Math.min(Number(goal.current_amount) + value, Number(goal.target_amount));
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: newAmount })
      .eq("id", goal.id);
    if (error) toast.error(error.message);
    else {
      toast.success(newAmount >= goal.target_amount ? "Meta atingida! 🎉" : "Contribuição registrada!");
      setContribGoalId(null);
      setContribValue("");
      load();
    }
    setContribSaving(false);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!activeProfile) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Metas</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova meta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Meta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-16" />
                <Input placeholder="Nome da meta" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
              </div>
              <Input type="number" placeholder="Valor alvo (R$)" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
              <div>
                <label className="text-xs text-muted-foreground">Prazo (opcional)</label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" />
              </div>
              {isCouple && trips.length > 0 && (
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger><SelectValue placeholder="Vincular a viagem (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {trips.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleAdd} className="w-full" disabled={!name || !targetAmount}>
                Salvar meta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhuma meta criada ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
            const isContribOpen = contribGoalId === goal.id;
            const done = pct >= 100;
            return (
              <Card key={goal.id} className="border-[0.5px]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{goal.name}</p>
                      {goal.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Prazo: {format(new Date(goal.deadline), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${done ? "text-positive" : ""}`}>
                      {Math.round(pct)}%
                    </span>
                  </div>

                  <Progress value={pct} className="h-2" />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(goal.current_amount)}</span>
                    <span>{fmt(goal.target_amount)}</span>
                  </div>

                  {/* Contribuição inline */}
                  {!done && (
                    isContribOpen ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Valor (R$)"
                          value={contribValue}
                          onChange={(e) => setContribValue(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleContrib(goal);
                            if (e.key === "Escape") { setContribGoalId(null); setContribValue(""); }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          disabled={contribSaving || !contribValue}
                          onClick={() => handleContrib(goal)}
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => { setContribGoalId(null); setContribValue(""); }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                        onClick={() => setContribGoalId(goal.id)}
                      >
                        <PlusCircle className="h-3 w-3 mr-1" /> Adicionar contribuição
                      </Button>
                    )
                  )}

                  {done && (
                    <p className="text-xs text-center text-positive font-medium">Meta atingida! 🎉</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
