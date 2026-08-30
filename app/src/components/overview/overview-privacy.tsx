"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/api";

const PrivacyContext = createContext<{ hidden: boolean; setHidden: Dispatch<SetStateAction<boolean>> } | null>(null);

export function OverviewPrivacy({ children, initialHidden }: { children: ReactNode; initialHidden: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  return <PrivacyContext.Provider value={{ hidden, setHidden }}>{children}</PrivacyContext.Provider>;
}

export function PrivacyToggle() {
  const privacy = useContext(PrivacyContext);
  if (!privacy) throw new Error("PrivacyToggle must be used within OverviewPrivacy");
  const { hidden, setHidden } = privacy;
  async function toggle() {
    const next = !hidden;
    setHidden(next);
    try { await mutate("/dashboard-preferences", "POST", { hide_balances: next }); }
    catch { setHidden(!next); toast.error("Could not save balance privacy"); }
  }
  return <Button variant="ghost" size="icon-sm" aria-label={hidden ? "Show balances" : "Hide balances"} title={hidden ? "Show balances" : "Hide balances"} onClick={toggle}>
    {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
  </Button>;
}

export function PrivateAmount({ children }: { children: ReactNode }) {
  const privacy = useContext(PrivacyContext);
  if (!privacy) throw new Error("PrivateAmount must be used within OverviewPrivacy");
  return <span aria-label={privacy.hidden ? "Balance hidden" : undefined}>{privacy.hidden ? "••••" : children}</span>;
}
