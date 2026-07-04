// Admin login shell — deliberately separate from the admin dashboard shell so
// there is NO auth guard and NO admin nav here (an unauthenticated visitor must
// be able to reach this page). Dark, centered card to signal the staff portal.
export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
