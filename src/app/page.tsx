import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Xarvisrobo — Under Construction
      </h1>
      <p className="text-muted-foreground max-w-md text-balance">
        The customer store and internal manufacturing dashboard are being built.
        Check back soon.
      </p>
      <Button>shadcn Button — smoke test</Button>
    </main>
  );
}
