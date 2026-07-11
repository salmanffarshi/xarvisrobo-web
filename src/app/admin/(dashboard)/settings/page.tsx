// Admin Settings page (Phase E.4 Part A). Server component: the (dashboard)
// layout already guards staff. Reads the Settings singleton and hands it to the
// client editor. These are the DB-backed, admin-editable values that drive the
// customer payment instructions, the WhatsApp handoff, and the COD charges.

import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/auth-guards";
import { getSettings } from "@/services/settings-service";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  await requireStaffPage();
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Payment-receiving details, WhatsApp number, and COD delivery charges.
          Changes apply to new orders immediately.
        </p>
      </header>

      <SettingsForm settings={settings} />
    </div>
  );
}
