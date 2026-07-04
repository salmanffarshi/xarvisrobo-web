import { auth } from "@/auth";

// Admin dashboard placeholder. The (dashboard) layout guards this route
// (redirects customers / unauthenticated), so a staff session exists here.
export default async function AdminDashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  const role = session?.user?.role ?? "";

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Xarvisrobo Admin Dashboard
      </h1>
      <p className="text-muted-foreground mt-2">
        {name} ({role})
      </p>
      <p className="text-muted-foreground mt-6 text-sm">
        The real dashboard — orders, payments, manufacturing, and customers —
        arrives in Phase E.
      </p>
    </section>
  );
}
