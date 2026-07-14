"use client";

// Admin Settings editor (Phase E.4 Part A). Edits the DB-backed Settings
// singleton: bKash/Nagad receiving details, the WhatsApp handoff number, the two
// COD delivery charges, and the general payment note. Validated with the SAME
// zod schema the API uses (updateSettingsSchema), so client and server agree.
// Save → PATCH /api/v1/admin/settings → toast + router.refresh().

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Settings } from "@prisma/client";

import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// The Settings row's nullable text columns map to empty strings in the form
// (the schema treats "" as an omitted optional after its .trim()).
function toDefaults(settings: Settings): UpdateSettingsInput {
  return {
    bkashNumber: settings.bkashNumber,
    bkashType: settings.bkashType as "personal" | "merchant",
    bkashInstructions: settings.bkashInstructions ?? "",
    nagadNumber: settings.nagadNumber,
    nagadType: settings.nagadType as "personal" | "merchant",
    nagadInstructions: settings.nagadInstructions ?? "",
    whatsappNumber: settings.whatsappNumber,
    messengerUrl: settings.messengerUrl ?? "",
    codInsideDhaka: settings.codInsideDhaka,
    codOutsideDhaka: settings.codOutsideDhaka,
    paymentGeneralNote: settings.paymentGeneralNote ?? "",
  };
}

function AccountTypeSelect({
  value,
  onChange,
}: {
  value: "personal" | "merchant";
  onChange: (value: "personal" | "merchant") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "personal" | "merchant")}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="personal">Personal</SelectItem>
        <SelectItem value="merchant">Merchant</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: toDefaults(settings),
  });

  async function onSubmit(values: UpdateSettingsInput) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not save settings.");
      }
      toast.success("Settings saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* bKash */}
        <Card>
          <CardHeader>
            <CardTitle>bKash</CardTitle>
            <CardDescription>
              The receiving number and instructions customers see when paying
              with bKash.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="bkashNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>bKash number</FormLabel>
                  <FormControl>
                    <Input placeholder="01XXXXXXXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bkashType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account type</FormLabel>
                  <FormControl>
                    <AccountTypeSelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bkashInstructions"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Instructions (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Use 'Send Money', not 'Payment'."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Nagad */}
        <Card>
          <CardHeader>
            <CardTitle>Nagad</CardTitle>
            <CardDescription>
              The receiving number and instructions customers see when paying
              with Nagad.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nagadNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nagad number</FormLabel>
                  <FormControl>
                    <Input placeholder="01XXXXXXXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nagadType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account type</FormLabel>
                  <FormControl>
                    <AccountTypeSelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nagadInstructions"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Instructions (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Use 'Send Money', not 'Payment'."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Delivery + contact */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery &amp; contact</CardTitle>
            <CardDescription>
              COD delivery charges (whole taka) and the WhatsApp number used for
              payment / order handoffs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="codInsideDhaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>COD charge — Inside Dhaka (৳)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? NaN : e.target.valueAsNumber,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="codOutsideDhaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>COD charge — Outside Dhaka (৳)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? NaN : e.target.valueAsNumber,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="whatsappNumber"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>WhatsApp number</FormLabel>
                  <FormControl>
                    <Input placeholder="8801XXXXXXXXX" {...field} />
                  </FormControl>
                  <FormDescription>
                    International format, digits only (no +, no spaces).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="messengerUrl"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Facebook Messenger link</FormLabel>
                  <FormControl>
                    <Input placeholder="https://m.me/yourpage" {...field} />
                  </FormControl>
                  <FormDescription>
                    Leave blank to hide the Messenger button.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* General note */}
        <Card>
          <CardHeader>
            <CardTitle>Payment note</CardTitle>
            <CardDescription>
              Shown to customers under the payment instructions. Prepaid delivery
              is always free (ADR-016) — only the COD charges above apply.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="paymentGeneralNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General payment note (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
