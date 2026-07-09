"use client";

// Payment-proof form (Phase D.2). Prepaid orders in WAITING_FOR_PAYMENT only.
// The three text fields (txn id, sender number, amount) are validated with the
// shared zod schema. The screenshot is OPTIONAL and handled outside the form
// state: on submit, if a file is chosen it's uploaded straight to Cloudinary
// (signed) and only the returned URL is sent to our API — big files never hit
// our server. On success we open the WhatsApp handoff (so the customer can send
// the image) and refresh the page into the "submitted" state.

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { submitProofSchema } from "@/lib/validations/payment";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  uploadPaymentProof,
} from "@/lib/upload-client";
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

// The form collects only the text fields; the screenshot URL is derived from
// the upload, not typed, so it's omitted from the resolver schema.
const formSchema = submitProofSchema.omit({ screenshotUrl: true });
type FormValues = z.infer<typeof formSchema>;

export function PaymentProofForm({
  orderNumber,
  defaultAmount,
  whatsappUrl,
}: {
  orderNumber: string;
  defaultAmount: string;
  whatsappUrl: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionId: "",
      senderNumber: "",
      paidAmount: defaultAmount,
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;

    // Same guards the uploader enforces — surfaced early for a friendly message.
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(chosen.type)) {
      toast.error("Please choose a JPG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      toast.error("That image is larger than 5MB. Please choose a smaller one.");
      e.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(values: FormValues) {
    let screenshotUrl: string | undefined;

    // 1. Upload the screenshot first (if any). A failure here stops us before
    //    we touch the order — the customer can retry or submit without it.
    if (file) {
      setUploading(true);
      try {
        const result = await uploadPaymentProof(file);
        screenshotUrl = result.url;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "The image upload failed.",
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // 2. Submit the proof to our API.
    try {
      const res = await fetch(
        `/api/v1/me/orders/${orderNumber}/payment-proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, screenshotUrl }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.error?.code;
        if (code === "INVALID_STATE") {
          toast.error("This order can no longer accept payment details.");
        } else if (code === "INVALID_SCREENSHOT") {
          toast.error("There was a problem with your screenshot. Please try again.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      // 3. Success: confirm, open the WhatsApp handoff so they can send the
      //    image, and refresh into the submitted state (which keeps a WhatsApp
      //    button as a fallback if the popup was blocked).
      toast.success("Payment details received.");
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  const busy = uploading || form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
        <FormField
          control={form.control}
          name="transactionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction ID</FormLabel>
              <FormControl>
                <Input
                  className="rounded-xl"
                  placeholder="e.g. TXN1A2B3C4D"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="senderNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sender number</FormLabel>
              <FormControl>
                <Input
                  className="rounded-xl"
                  inputMode="numeric"
                  placeholder="01XXXXXXXXX"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paidAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount paid (BDT)</FormLabel>
              <FormControl>
                <Input
                  className="rounded-xl"
                  inputMode="decimal"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Optional screenshot */}
        <div className="grid gap-2">
          <span className="text-sm font-medium">
            Payment screenshot{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={onFileChange}
            className="hidden"
          />
          {previewUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Payment screenshot preview"
                className="size-16 rounded-lg border border-neutral-200 object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="text-neutral-600"
              >
                <X className="size-4" />
                Remove
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-fit rounded-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Choose image
            </Button>
          )}
          <p className="text-xs text-neutral-500">JPG, PNG, or WebP · up to 5MB.</p>
        </div>

        <div>
          <Button
            type="submit"
            size="lg"
            className="rounded-full px-8"
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {uploading ? "Uploading…" : "Submit payment details"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
