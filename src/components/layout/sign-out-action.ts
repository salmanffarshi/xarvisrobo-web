"use server";

import { signOut } from "@/auth";

// Server action: clears the Auth.js session cookie and sends the user home.
// Lives in its own "use server" file so client components (the account
// dropdown) can import and invoke it without bundling server code.
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
