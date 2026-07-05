import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = {
  title: "Change password",
};

// Change-password page (Phase B.3). No server data needed — the form posts to
// /api/v1/me/password, which verifies the current password server-side. Per
// ADR-014 (JWT sessions) the user stays signed in on this device afterwards.
export default function ChangePasswordPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">
        Change password
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        You&apos;ll stay signed in on this device after the change.
      </p>

      <div className="mt-8 max-w-lg">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
