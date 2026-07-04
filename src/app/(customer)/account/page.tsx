import { auth } from "@/auth";

// Customer account placeholder. The (customer) layout already guards this route
// (redirects non-customers), so a session exists here; we still read defensively.
export default async function AccountPage() {
  const session = await auth();
  const name = session?.user?.name ?? "there";
  const email = session?.user?.email ?? "";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {name}.
      </h1>
      {email && <p className="text-muted-foreground mt-2">{email}</p>}
      <p className="text-muted-foreground mt-6 text-sm">
        Your full account dashboard — orders, addresses, and payments — arrives
        in Phase D.
      </p>
    </section>
  );
}
