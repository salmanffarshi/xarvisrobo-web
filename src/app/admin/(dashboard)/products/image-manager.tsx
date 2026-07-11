"use client";

// Product image manager (Phase E.4 Part B). Edit-only (needs a product id to
// attach to). Uploads straight to Cloudinary via the signed products-folder
// endpoint, then attaches the returned URL through the image API. Set-primary,
// reorder (swap with neighbor), and remove each call the API then router.refresh
// so the server re-renders the fresh, ordered image list.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadProductImage } from "@/lib/upload-client";
import type { AdminProductImage } from "@/services/product-admin-service";

export function ImageManager({
  productId,
  images,
}: {
  productId: string;
  images: AdminProductImage[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const base = `/api/v1/admin/products/${productId}/images`;

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(data?.error?.message ?? "Action failed.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await uploadProductImage(file);
      await call("POST", base, { url });
      toast.success("Image added.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<void>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function setPrimary(imageId: string) {
    return act(() => call("PATCH", `${base}/${imageId}`, { isPrimary: true }), "Primary image set.");
  }

  function remove(imageId: string) {
    return act(() => call("DELETE", `${base}/${imageId}`), "Image removed.");
  }

  // Swap sort order with the neighbor in the given direction.
  function move(index: number, dir: -1 | 1) {
    const a = images[index];
    const b = images[index + dir];
    if (!a || !b) return;
    return act(async () => {
      await call("PATCH", `${base}/${a.id}`, { sortOrder: b.sortOrder });
      await call("PATCH", `${base}/${b.id}`, { sortOrder: a.sortOrder });
    }, "Order updated.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          Upload image
        </Button>
        <span className="text-muted-foreground text-xs">JPG, PNG, or WebP · up to 5MB</span>
      </div>

      {images.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No images yet. Uploaded images appear on the customer catalog; the
          primary one is the thumbnail.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border">
              <div className="bg-muted relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.altText ?? ""} className="size-full object-cover" />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                    Primary
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move left"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy || i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move right"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy || img.isPrimary}
                    onClick={() => setPrimary(img.id)}
                    aria-label="Set as primary"
                  >
                    <Star className={img.isPrimary ? "size-4 fill-current" : "size-4"} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(img.id)}
                    aria-label="Remove image"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
