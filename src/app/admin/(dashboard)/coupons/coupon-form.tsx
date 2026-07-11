"use client";

// Coupon create/edit form (Phase E.5). Shared by /new and /[id]/edit. Plain
// controlled state (not react-hook-form) because the fields map awkwardly onto
// a resolver: blank usage limits mean "unlimited" (→ null) and blank dates mean
// "no bound" (→ null). The submit handler builds the JSON body explicitly —
// numbers, ISO dates, and nulls — and POSTs (create) or PATCHes (edit). The
// server re-validates everything (ADR-003); field errors come back in details.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CouponFormInitial = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  minOrderAmount: string;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: string | null; // ISO
  validUntil: string | null; // ISO
  isActive: boolean;
};

/** ISO → the value a <input type="datetime-local"> expects, in local time. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function CouponForm({ initial }: { initial?: CouponFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">(
    initial?.discountType ?? "PERCENTAGE",
  );
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? "");
  const [minOrderAmount, setMinOrderAmount] = useState(
    initial?.minOrderAmount ?? "0",
  );
  const [totalUsageLimit, setTotalUsageLimit] = useState(
    initial?.totalUsageLimit != null ? String(initial.totalUsageLimit) : "",
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    initial?.perCustomerLimit != null ? String(initial.perCustomerLimit) : "",
  );
  const [validFrom, setValidFrom] = useState(
    initial?.validFrom ? isoToLocalInput(initial.validFrom) : "",
  );
  const [validUntil, setValidUntil] = useState(
    initial?.validUntil ? isoToLocalInput(initial.validUntil) : "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const body = {
      code,
      description: description.trim() || undefined,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount || "0"),
      totalUsageLimit: totalUsageLimit.trim() ? Number(totalUsageLimit) : null,
      perCustomerLimit: perCustomerLimit.trim() ? Number(perCustomerLimit) : null,
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      isActive,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/v1/admin/coupons/${initial!.id}` : "/api/v1/admin/coupons",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        toast.success(isEdit ? "Coupon updated." : "Coupon created.");
        router.push("/admin/coupons");
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string; details?: Record<string, string[]> };
      } | null;
      const details = data?.error?.details;
      if (details) {
        const fieldErrors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(details)) {
          if (messages?.[0]) fieldErrors[field] = messages[0];
        }
        setErrors(fieldErrors);
      }
      toast.error(data?.error?.message ?? "Could not save the coupon.");
      setSaving(false);
    } catch {
      toast.error("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-6">
      {/* Code */}
      <div className="space-y-2">
        <Label htmlFor="code">Coupon code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SAVE10"
          className="uppercase"
          autoCapitalize="characters"
        />
        {errors.code && <p className="text-sm text-red-600">{errors.code}</p>}
        <p className="text-muted-foreground text-xs">
          Stored uppercase and matched case-insensitively.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Launch week 10% off"
          maxLength={200}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description}</p>
        )}
      </div>

      {/* Type + value */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Discount type</Label>
          <Select
            value={discountType}
            onValueChange={(v) => setDiscountType(v as "PERCENTAGE" | "FIXED")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
              <SelectItem value="FIXED">Fixed amount (৳)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountValue">
            {discountType === "PERCENTAGE" ? "Percentage (%)" : "Amount (৳)"}
          </Label>
          <Input
            id="discountValue"
            type="number"
            min="0"
            step={discountType === "PERCENTAGE" ? "1" : "0.01"}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "PERCENTAGE" ? "10" : "200"}
          />
          {errors.discountValue && (
            <p className="text-sm text-red-600">{errors.discountValue}</p>
          )}
        </div>
      </div>

      {/* Min order */}
      <div className="space-y-2">
        <Label htmlFor="minOrderAmount">Minimum order subtotal (৳)</Label>
        <Input
          id="minOrderAmount"
          type="number"
          min="0"
          step="0.01"
          value={minOrderAmount}
          onChange={(e) => setMinOrderAmount(e.target.value)}
          placeholder="0"
        />
        {errors.minOrderAmount && (
          <p className="text-sm text-red-600">{errors.minOrderAmount}</p>
        )}
        <p className="text-muted-foreground text-xs">
          The discount applies to the subtotal only — delivery is never discounted.
        </p>
      </div>

      {/* Limits */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="totalUsageLimit">Total usage limit</Label>
          <Input
            id="totalUsageLimit"
            type="number"
            min="1"
            step="1"
            value={totalUsageLimit}
            onChange={(e) => setTotalUsageLimit(e.target.value)}
            placeholder="Unlimited"
          />
          {errors.totalUsageLimit && (
            <p className="text-sm text-red-600">{errors.totalUsageLimit}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="perCustomerLimit">Per-customer limit</Label>
          <Input
            id="perCustomerLimit"
            type="number"
            min="1"
            step="1"
            value={perCustomerLimit}
            onChange={(e) => setPerCustomerLimit(e.target.value)}
            placeholder="Unlimited"
          />
          {errors.perCustomerLimit && (
            <p className="text-sm text-red-600">{errors.perCustomerLimit}</p>
          )}
        </div>
      </div>

      {/* Validity window */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="validFrom">Valid from (optional)</Label>
          <Input
            id="validFrom"
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validUntil">Valid until (optional)</Label>
          <Input
            id="validUntil"
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
          {errors.validUntil && (
            <p className="text-sm text-red-600">{errors.validUntil}</p>
          )}
        </div>
      </div>

      {/* Active */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active (customers can apply this coupon)
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create coupon"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/coupons")}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
