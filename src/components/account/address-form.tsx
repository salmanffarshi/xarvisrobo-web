"use client";

// Address create/edit form (Phase B.3). One component for both modes: pass an
// `address` prop to edit, omit it to create. The district <select> and the zod
// validation read the same BD_DISTRICTS list, so they can never disagree.

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BD_DISTRICTS } from "@/lib/data/bd-districts";
import {
  addressSchema,
  type AddressInput,
} from "@/lib/validations/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** The fields a card/form needs — timestamps stay server-side. */
export type AddressData = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault: boolean;
};

export function AddressForm({
  address,
  onSuccess,
}: {
  address?: AddressData;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const isEdit = address !== undefined;

  const form = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: address?.label ?? "",
      recipientName: address?.recipientName ?? "",
      phone: address?.phone ?? "",
      streetAddress: address?.streetAddress ?? "",
      city: address?.city ?? "",
      district: address?.district ?? "",
      postalCode: address?.postalCode ?? "",
      isDefault: address?.isDefault ?? false,
    },
  });

  async function onSubmit(values: AddressInput) {
    try {
      const res = await fetch(
        isEdit ? `/api/v1/me/addresses/${address.id}` : "/api/v1/me/addresses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      if (!res.ok) {
        toast.error("Something went wrong. Please try again.");
        return;
      }

      toast.success(isEdit ? "Address updated." : "Address added.");
      onSuccess();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input
                  className="rounded-xl"
                  placeholder="Home, Office…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="recipientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient name</FormLabel>
                <FormControl>
                  <Input
                    className="rounded-xl"
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
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    className="rounded-xl"
                    placeholder="01712345678"
                    autoComplete="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="streetAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street address</FormLabel>
              <FormControl>
                <Input
                  className="rounded-xl"
                  placeholder="House, road, flat…"
                  autoComplete="street-address"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input className="rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal code</FormLabel>
                <FormControl>
                  <Input
                    className="rounded-xl"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1207"
                    autoComplete="postal-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="district"
          render={({ field }) => (
            <FormItem>
              <FormLabel>District</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="Select a district" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BD_DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isDefault"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  // The current default can't be un-defaulted — you'd have no
                  // default left. Make another address the default instead.
                  disabled={address?.isDefault === true}
                />
                Set as default address
              </label>
              {address?.isDefault === true && (
                <p className="text-xs text-neutral-500">
                  This is your default address. To change it, set another
                  address as default.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-2">
          <Button
            type="submit"
            className="w-full rounded-full sm:w-auto sm:px-8"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add address"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
