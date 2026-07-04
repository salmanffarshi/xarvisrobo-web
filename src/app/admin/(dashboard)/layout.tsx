import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

// Admin shell — wraps every staff dashboard route (/admin, and later
// /admin/orders, /admin/products, ...). Lives in the (dashboard) route group so
// it does NOT wrap /admin/login (which would cause a redirect loop). This is the
// precise Node-runtime gate: any missing session or a CUSTOMER role is bounced
// to the admin login.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role === "CUSTOMER") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Xarvisrobo Admin
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">{session.user.name}</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-200">
              {session.user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/admin/login" });
              }}
            >
              <button
                type="submit"
                className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
