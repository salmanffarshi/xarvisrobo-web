import { signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth-guards";
import { AdminMobileBar } from "./admin-mobile-bar";
import { AdminNav } from "./admin-nav";

// Admin shell — wraps every staff dashboard route (/admin, and later
// /admin/orders, /admin/products, ...). Lives in the (dashboard) route group so
// it does NOT wrap /admin/login (which would cause a redirect loop). The
// middleware already gates /admin; `requireStaffPage` is the precise
// Node-runtime belt on top of it — any missing session or a CUSTOMER role is
// bounced to the admin login (Phase E.1).
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffPage();

  // The signed-in identity + sign-out, rendered once and shown in both the
  // desktop sidebar footer and the mobile Sheet. The sign-out is a server
  // action; keeping this node on the server lets the client Sheet reuse it.
  const userFooter = (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <span className="truncate text-sm font-medium">
          {session.user.name}
        </span>
        <Badge variant="secondary" className="w-fit">
          {session.user.role}
        </Badge>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
      >
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="bg-muted/30 flex min-h-screen">
      {/* Desktop sidebar — sticky, full-height dashboard chrome. */}
      <aside className="bg-card hidden w-64 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b px-6 py-5 text-lg font-semibold tracking-tight">
          Xarvisrobo Admin
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <AdminNav />
        </div>
        <div className="border-t">{userFooter}</div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminMobileBar footer={userFooter} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
