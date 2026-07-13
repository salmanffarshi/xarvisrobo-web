"use client";

// Product create/edit form (Phase E.4 Part B). Shared by /new and /[id]/edit.
// Scalar fields + an ordered specifications editor (add / remove / move up-down,
// preserving order). Save → toast + redirect to the list. The image manager is
// edit-only (it needs a saved product id) and is rendered by the edit page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createProductSchema,
  type CreateProductInput,
} from "@/lib/validations/product";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type ProductFormValues = CreateProductInput;

export type ProductFormInitial = {
  id: string;
  values: CreateProductInput;
};

export function ProductForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: initial?.values ?? {
      name: "",
      sku: "",
      shortDescription: "",
      description: "",
      categoryId: "",
      basePrice: "",
      stockQuantity: 0,
      isActive: true,
      isFeatured: false,
      specifications: [],
      features: [],
      metaTitle: "",
      metaDescription: "",
    },
  });

  const specs = useFieldArray({ control: form.control, name: "specifications" });
  const features = useFieldArray({ control: form.control, name: "features" });

  async function onSubmit(values: CreateProductInput) {
    setIsSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/v1/admin/products/${initial!.id}` : "/api/v1/admin/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not save the product.");
      }
      toast.success(isEdit ? "Product saved." : "Product created.");
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the product.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing &amp; inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base price (৳)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="2999.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stockQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock quantity</FormLabel>
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
            <div className="flex items-center gap-6 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...form.register("isActive")} />
                Active (visible in catalog)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...form.register("isFeatured")} />
                Featured
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
            <CardDescription>
              Shown in the order entered. Use the arrows to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {specs.fields.length === 0 && (
              <p className="text-muted-foreground text-sm">No specs yet.</p>
            )}
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Label (e.g. Processor)"
                    {...form.register(`specifications.${i}.label`)}
                  />
                  <Input
                    placeholder="Value (e.g. ESP32-S3)"
                    {...form.register(`specifications.${i}.value`)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => specs.move(i, i - 1)}
                    aria-label="Move spec up"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === specs.fields.length - 1}
                    onClick={() => specs.move(i, i + 1)}
                    aria-label="Move spec down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => specs.remove(i)}
                    aria-label="Remove spec"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => specs.append({ label: "", value: "" })}
            >
              <Plus className="mr-2 size-4" />
              Add spec
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              Highlights shown on the product page between the description and
              specifications, in the order entered. Description is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {features.fields.length === 0 && (
              <p className="text-muted-foreground text-sm">No features yet.</p>
            )}
            {features.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="grid flex-1 gap-2">
                  <Input
                    placeholder="Title (e.g. All-day battery)"
                    {...form.register(`features.${i}.title`)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    {...form.register(`features.${i}.description`)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => features.move(i, i - 1)}
                    aria-label="Move feature up"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === features.fields.length - 1}
                    onClick={() => features.move(i, i + 1)}
                    aria-label="Move feature down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => features.remove(i)}
                    aria-label="Remove feature"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => features.append({ title: "", description: "" })}
            >
              <Plus className="mr-2 size-4" />
              Add feature
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="metaTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metaDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
