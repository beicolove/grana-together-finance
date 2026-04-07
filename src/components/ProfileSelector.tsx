import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";

const bgMap: Record<string, string> = {
  blue:  "bg-profile-lucas",
  green: "bg-profile-gisele",
  amber: "gradient-casal",
};

const ringMap: Record<string, string> = {
  blue:  "ring-profile-lucas",
  green: "ring-profile-gisele",
  amber: "ring-[#E91E8C]",
};

export function ProfileSelector() {
  const { profiles, activeProfile, setActiveProfile } = useProfile();

  return (
    <div className="flex items-center gap-1.5">
      {profiles.map((p) => {
        const isActive = activeProfile?.id === p.id;
        const isCouple = p.color === "amber";
        return (
          <button
            key={p.id}
            onClick={() => setActiveProfile(p)}
            title={p.name}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all",
              isActive
                ? cn(
                    "text-white ring-2 ring-offset-2 ring-offset-card",
                    isCouple
                      ? `gradient-casal ${ringMap.amber}`
                      : `${bgMap[p.color]} ${ringMap[p.color]}`
                  )
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            <span className="text-xs leading-none">{p.avatar_initials}</span>
            <span className="hidden sm:inline">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
