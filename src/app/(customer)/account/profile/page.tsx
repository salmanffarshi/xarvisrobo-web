import type { Metadata } from "next";

import { auth } from "@/auth";
import { getProfile } from "@/services/account-service";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

// Profile page (Phase B.3). Server component fetches the current profile via
// the service (ADR-003) and passes it to the client form.
export default async function ProfilePage() {
  const session = await auth();
  const profile = await getProfile(session!.user.id);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Your name and phone number. Your email identifies your account.
      </p>

      <div className="mt-8 max-w-lg">
        <ProfileForm
          name={profile.name}
          email={profile.email}
          phone={profile.phone}
        />
      </div>
    </section>
  );
}
