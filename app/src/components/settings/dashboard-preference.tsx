"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { mutate } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardPreference } from "@/lib/types";

export function DashboardPreferenceSelect({ preference }: { preference: DashboardPreference }) {
  const router = useRouter();
  async function onValueChange(account_grouping: DashboardPreference["account_grouping"] | null) {
    if (!account_grouping || account_grouping === preference.account_grouping) return;
    try {
      await mutate("/dashboard-preferences", "POST", { account_grouping });
      router.refresh();
    } catch {
      toast.error("Could not save dashboard grouping");
    }
  }

  return <Select value={preference.account_grouping} onValueChange={onValueChange} items={[
    { value: "institution", label: "Institution" },
    { value: "account_type", label: "Account type" },
  ]}>
    <SelectTrigger aria-label="Overview account grouping" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="institution">Institution</SelectItem>
      <SelectItem value="account_type">Account type</SelectItem>
    </SelectContent>
  </Select>;
}
