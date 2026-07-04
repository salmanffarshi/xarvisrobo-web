// Auth shell — centers the login/register cards on the page. No navigation, so
// the forms are the focus. Customer-facing (light) styling; the admin login has
// its own darker shell.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
