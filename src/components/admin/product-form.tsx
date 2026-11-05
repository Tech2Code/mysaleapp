"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { siteConfig } from "@/config/site"
import { saveProduct } from "@/features/products/actions"
import { productSchema, type ProductInput, type ProductValues } from "@/features/products/schema"
import type { Category, Product } from "@/features/products/types"
import { slugify } from "@/lib/format"
import { nativeSelectClass } from "./admin-page-header"
import { ImageUploader } from "./image-uploader"

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="font-sans text-lg font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

export function ProductForm({
  product,
  categories,
}: {
  product: Product | null
  categories: Pick<Category, "id" | "name">[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [slugTouched, setSlugTouched] = useState(Boolean(product))

  const form = useForm<ProductInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      price: product?.price ?? "",
      compareAtPrice: product?.compareAtPrice ?? "",
      images: product?.images ?? [],
      categoryId: product?.categoryId ?? "",
      stock: product?.stock ?? 10,
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      seoTitle: product?.seoTitle ?? "",
      seoDescription: product?.seoDescription ?? "",
    },
  })
  const { errors } = form.formState
  const [name, slug, description, seoTitle, seoDescription] = useWatch({
    control: form.control,
    name: ["name", "slug", "description", "seoTitle", "seoDescription"],
  })

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveProduct(product?.id ?? null, values)
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(field as keyof ProductInput, { message: messages[0] })
        }
        return
      }
      toast.success(product ? "Product updated — live on the store" : "Product created — live on the store")
      router.push("/admin/products")
      router.refresh()
    })
  )

  const previewTitle = (seoTitle as string) || `${name || "Product name"} | ${siteConfig.name}`
  const previewDesc = (seoDescription as string) || (description as string)?.slice(0, 155) || "Product description…"

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Section title="Basic details">
          <FormField label="Product name" error={errors.name?.message}>
            <Input
              className="h-10"
              {...form.register("name", {
                onChange: (e) => {
                  if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: false })
                },
              })}
            />
          </FormField>
          <FormField label="URL slug" error={errors.slug?.message} hint={`${siteConfig.url}/products/${slug || "…"}`}>
            <Input className="h-10 font-mono text-sm" {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
          </FormField>
          <FormField label="Description" error={errors.description?.message} hint="Size, materials, care instructions — this also helps Google find you.">
            <Textarea rows={7} {...form.register("description")} />
          </FormField>
        </Section>

        <Section title="Photos" description="Up to 8 photos. Good photos sell!">
          <Controller
            control={form.control}
            name="images"
            render={({ field }) => <ImageUploader value={(field.value as string[]) ?? []} onChange={field.onChange} />}
          />
          {errors.images && <p className="text-xs font-medium text-destructive">{errors.images.message ?? "Invalid image"}</p>}
        </Section>

        <Section title="Search engine listing" description="How this product appears on Google. Leave blank to auto-fill.">
          <div className="rounded-xl border bg-background p-4">
            <p className="truncate text-xs text-muted-foreground">
              {siteConfig.url.replace(/^https?:\/\//, "")} › products › {slug || "…"}
            </p>
            <p className="mt-1 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{previewTitle}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{previewDesc}</p>
          </div>
          <FormField label="SEO title" error={errors.seoTitle?.message} hint={`${(seoTitle as string)?.length ?? 0}/70`}>
            <Input className="h-10" {...form.register("seoTitle")} />
          </FormField>
          <FormField label="SEO description" error={errors.seoDescription?.message} hint={`${(seoDescription as string)?.length ?? 0}/160`}>
            <Textarea rows={2} {...form.register("seoDescription")} />
          </FormField>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
        <Section title="Visibility">
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="block font-medium">Active</span>
                  <span className="text-muted-foreground">Visible in the store</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          <Controller
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="block font-medium">Featured</span>
                  <span className="text-muted-foreground">Show on the home page</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
        </Section>

        <Section title="Pricing & stock">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price (₹)" error={errors.price?.message}>
              <Input className="h-10" inputMode="decimal" {...form.register("price")} />
            </FormField>
            <FormField label="MRP (₹)" error={errors.compareAtPrice?.message} hint="Optional, shows a discount">
              <Input className="h-10" inputMode="decimal" {...form.register("compareAtPrice")} />
            </FormField>
          </div>
          <FormField label="Stock" error={errors.stock?.message} hint="0 = sold out">
            <Input className="h-10" inputMode="numeric" {...form.register("stock")} />
          </FormField>
          <FormField label="Category" error={errors.categoryId?.message}>
            <select className={nativeSelectClass} {...form.register("categoryId")}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
        </Section>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 flex-1 rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} {product ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  )
}
