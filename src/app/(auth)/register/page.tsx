"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { mergeGuestCartOnAuth } from "@/lib/cart/merge-on-auth";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

function RegisterForm() {
  const router = useRouter();
  // Where to send the user after registering. A guest sent here from checkout
  // carries ?callbackUrl=/checkout (that still wins); anything absent or unsafe
  // falls back to Home (open-redirect guard — see src/lib/safe-callback-url.ts).
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", phone: undefined },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setServerError(
          data?.error?.message ?? "Something went wrong. Please try again."
        );
        return;
      }

      // Registration succeeded — sign the new customer in immediately.
      const signInResult = await signIn("customer-credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setServerError(
          "Your account was created, but automatic sign-in failed. Please sign in."
        );
        return;
      }

      // Fold any guest (localStorage) cart into the new account's cart before
      // the redirect — best-effort, never blocks the registration.
      await mergeGuestCartOnAuth();

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError(
        "Network error. Please check your connection and try again."
      );
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Join Xarvisrobo to order AI-enabled desk robots.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Salman Farshi"
                      autoComplete="name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="01712345678"
                      autoComplete="tel"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      // Map an empty input to `undefined` so a blank (optional)
                      // phone passes validation instead of failing the regex.
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : e.target.value
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Bangladesh number. You can add this later at checkout.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            // Preserve the return destination if the guest signs in instead.
            href={
              callbackUrl === "/"
                ? "/login"
                : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
            }
            className="text-foreground font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

// useSearchParams() requires a Suspense boundary on statically prerendered
// pages — without it, `next build` fails on this route.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
