import Link from "next/link";

// Public shell — wraps unauthenticated marketing/catalog pages. Header/footer
// are stubs for now; real navigation arrives with the catalog in Phase B.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Xarvisrobo
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-muted-foreground hover:text-foreground"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto max-w-6xl px-6 py-6 text-sm">
          © {new Date().getFullYear()} Xarvisrobo — pre-launch.
        </div>
      </footer>
    </div>
  );
}
