"use client";

// Change-password form (Phase B.3). All three fields are masked with a
// show/hide toggle. A wrong current password comes back from the API as
// INVALID_CURRENT_PASSWORD and is shown inline on that field.

import { useState } from "react";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** One masked field with an eye toggle. Local helper, not a ui primitive. */
function PasswordField({
  control,
  name,
  label,
  autoComplete,
  helperText,
}: {
  control: Control<ChangePasswordInput>;
  name: keyof ChangePasswordInput;
  label: string;
  autoComplete: string;
  helperText?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={visible ? "text" : "password"}
                className="rounded-xl pr-10"
                autoComplete={autoComplete}
                {...field}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {visible ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </FormControl>
          {helperText && (
            <p className="text-xs text-neutral-500">{helperText}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      const res = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "INVALID_CURRENT_PASSWORD") {
          form.setError("currentPassword", {
            message: "Current password is incorrect",
          });
          return;
        }
        toast.error("Something went wrong. Please try again.");
        return;
      }

      toast.success("Password changed.");
      form.reset();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-5"
        noValidate
      >
        <PasswordField
          control={form.control}
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
        />
        <PasswordField
          control={form.control}
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          helperText="At least 8 characters. Avoid common passwords."
        />
        <PasswordField
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
        />

        <div>
          <Button
            type="submit"
            size="lg"
            className="rounded-full px-8"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Change password
          </Button>
        </div>
      </form>
    </Form>
  );
}
