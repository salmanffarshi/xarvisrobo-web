"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    // The token comes from the URL and rides along as a hidden field so the
    // shared resetPasswordSchema (which requires it) validates the whole body.
    defaultValues: { token, newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        // No auto-login (ADR-002 intent): send them to sign in with the new
        // password. The flash is shown by the login page.
        router.push("/login?reset=success");
        return;
      }

      // A bad/expired/used token comes back generic — show it plus the way back.
      const data = await res.json().catch(() => null);
      setServerError(
        data?.error?.message ?? "This reset link is invalid or has expired."
      );
    } catch {
      setServerError(
        "Network error. Please check your connection and try again."
      );
    }
  }

  // No token in the link at all — treat it as an invalid link straight away.
  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Invalid reset link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <p className="text-muted-foreground text-sm">
            <Link
              href="/forgot-password"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Request a new link
            </Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for your Xarvisrobo account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {serverError}{" "}
              <Link
                href="/forgot-password"
                className="font-medium underline underline-offset-4"
              >
                Request a new link
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          <Link
            href="/login"
            className="text-foreground font-medium underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

// useSearchParams() requires a Suspense boundary on statically prerendered
// pages — without it, `next build` fails on this route.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
