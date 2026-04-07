import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProfileColor = "blue" | "green" | "amber";

export type ProfileData = {
  id: string;
  name: string;
  color: ProfileColor;
  avatar_initials: string;
};

type ProfileContextType = {
  profiles: ProfileData[];
  activeProfile: ProfileData | null;
  setActiveProfile: (profile: ProfileData) => void;
  loading: boolean;
  isCasal: boolean;
  fetchError: string | null;
};

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfile: () => {},
  loading: true,
  isCasal: false,
  fetchError: null,
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at");

        if (error) {
          // Table might not exist yet (SQL not run) or network error
          console.error("[Grana] Erro ao buscar perfis:", error.message);
          setFetchError(
            error.code === "42P01"
              ? "Tabela 'profiles' não encontrada. Execute o SQL de configuração no painel do Supabase."
              : `Erro ao carregar perfis: ${error.message}`
          );
          return;
        }

        if (data && data.length > 0) {
          const mapped: ProfileData[] = data.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color as ProfileColor,
            avatar_initials: p.avatar_initials,
          }));
          setProfiles(mapped);
          setActiveProfile(mapped[0]);
        } else {
          setFetchError("nenhum-perfil");
        }
      } catch (err) {
        console.error("[Grana] Falha inesperada ao buscar perfis:", err);
        setFetchError("Erro inesperado ao conectar ao banco de dados.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const isCasal = activeProfile?.color === "amber";

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfile, setActiveProfile, loading, isCasal, fetchError }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
