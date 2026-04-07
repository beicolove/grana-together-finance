import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Category = { id: string; name: string; emoji: string; color: string; profile_id: string };
type Trip = { id: string; name: string; start_date: string; end_date: string; status: string };

export default function SettingsPage() {
  const { activeProfile, isCasal } = useProfile();
  const isCouple = isCasal;
  const [categories, setCategories] = useState<Category[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("📁");
  const [tripName, setTripName] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");

  const loadData = async () => {
    if (!activeProfile) return;
    const { data: cats } = await supabase.from("categories").select("*").eq("profile_id", activeProfile.id);
    setCategories(cats || []);
    if (isCouple) {
      const { data: t } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      setTrips(t || []);
    }
  };

  useEffect(() => { loadData(); }, [activeProfile]);

  const addCategory = async () => {
    if (!activeProfile || !catName) return;
    const { error } = await supabase.from("categories").insert({
      profile_id: activeProfile.id,
      name: catName,
      emoji: catEmoji,
    });
    if (error) toast.error(error.message);
    else { toast.success("Categoria criada!"); setCatOpen(false); setCatName(""); setCatEmoji("📁"); loadData(); }
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria removida");
    loadData();
  };

  const addTrip = async () => {
    if (!tripName || !tripStart || !tripEnd) return;
    const { error } = await supabase.from("trips").insert({ name: tripName, start_date: tripStart, end_date: tripEnd });
    if (error) toast.error(error.message);
    else { toast.success("Viagem criada!"); setTripOpen(false); setTripName(""); setTripStart(""); setTripEnd(""); loadData(); }
  };

  const closeTrip = async (id: string) => {
    await supabase.from("trips").update({ status: "closed" as any }).eq("id", id);
    toast.success("Viagem encerrada");
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!activeProfile) return null;

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold">Configurações</h2>

      {/* Categories */}
      <Card className="border-[0.5px]">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Categorias</CardTitle>
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Emoji" value={catEmoji} onChange={(e) => setCatEmoji(e.target.value)} className="w-16" />
                  <Input placeholder="Nome" value={catName} onChange={(e) => setCatName(e.target.value)} className="flex-1" />
                </div>
                <Button onClick={addCategory} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-2 px-1">
                  <span className="text-sm">{cat.emoji} {cat.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => deleteCategory(cat.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trips (couple only) */}
      {isCouple && (
        <Card className="border-[0.5px]">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Períodos de viagem</CardTitle>
            <Dialog open={tripOpen} onOpenChange={setTripOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Nova viagem</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Viagem</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Nome (ex: Bolívia - Abril 2026)" value={tripName} onChange={(e) => setTripName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Início</label>
                      <Input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Fim</label>
                      <Input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={addTrip} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma viagem.</p>
            ) : (
              <div className="space-y-2">
                {trips.map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between py-2 px-1">
                    <div>
                      <p className="text-sm font-medium">{trip.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(trip.start_date), "dd/MM/yyyy")} — {format(new Date(trip.end_date), "dd/MM/yyyy")}
                        {trip.status === "active" && " • Ativa"}
                      </p>
                    </div>
                    {trip.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => closeTrip(trip.id)}>
                        Encerrar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Button variant="outline" onClick={handleLogout} className="w-full">
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
}
