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
};

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfile: () => {},
  loading: true,
  isCasal: false,
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at");
      if (data && data.length > 0) {
        const mapped: ProfileData[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color as ProfileColor,
          avatar_initials: p.avatar_initials,
        }));
        setProfiles(mapped);
        setActiveProfile(mapped[0]);
      }
      setLoading(false);
    };
    fetchProfiles();
  }, []);

  const isCasal = activeProfile?.color === "amber";

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfile, loading, isCasal }}>
      {children}
    </ProfileContext.Provider>
  );
};
