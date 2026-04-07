import { ProfileSelector } from "./ProfileSelector";

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
      <h1 className="text-lg font-bold">💰 Grana</h1>
      <ProfileSelector compact />
    </header>
  );
}
