import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { FloatingContactServer } from "@/components/contact/floating-contact-server";

// Customer shell — the PRECISE auth gate (ADR-013): middleware is the coarse
// edge check; this Node-runtime layout re-verifies the session and role before
// any customer page renders. A missing session or a non-customer role is bounced
// to the customer login.
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== "CUSTOMER") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Xarvisrobo
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{session.user.name}</span>
            {/* Sign out via a server action — Auth.js v5's signOut() handles
                CSRF and cookie clearing, which a raw POST form would not. */}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <FloatingContactServer />
    </div>
  );
}
