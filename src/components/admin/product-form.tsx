"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { saveProduct } from "@/features/products/actions"
import {
  MAX_HIGHLIGHTS,
  MAX_SPECS,
  productSchema,
  SHIPPING_CLASS_OPTIONS,
  SPEC_SUGGESTIONS,
  type ProductInput,
  type ProductValues,
} from "@/features/products/schema"
import type { Category, Product } from "@/features/products/types"
import { formatWeightGrams } from "@/features/orders/pricing"
import { formatPrice, slugify } from "@/lib/format"
import { ImageUploader } from "./image-uploader"
import { StickySaveBar } from "./sticky-save-bar"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section data-ui="admin/Section" className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 data-ui="admin/Section/h2" className="font-sans text-lg font-semibold">{title}</h2>
      {description && <p data-ui="admin/Section/p" className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div data-ui="admin/Section/div" className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function toFormValues(product: Product | null): ProductInput {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    shortDescription: product?.shortDescription ?? "",
    highlights: (product?.highlights ?? []).join("\n"),
    specs: product?.specs ?? [],
    careInstructions: product?.careInstructions ?? "",
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? "",
    images: product?.images ? [...product.images] : [],
    categoryId: product?.categoryId ?? "",
    stock: product?.stock ?? 10,
    weightGrams: product?.weightGrams ?? 0,
    shippingClass: product?.shippingClass ?? "standard",
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
  }
}

export function ProductForm({
  product,
  categories,
}: {
  product: Product | null
  categories: Pick<Category, "id" | "name">[]
}) {
  const [visitKey, setVisitKey] = useState(0)
  const [baselineProduct, setBaselineProduct] = useState<Product | null>(product)
  const [prevProductProp, setPrevProductProp] = useState<Product | null>(product)

  if (product !== prevProductProp) {
    setPrevProductProp(product)
    setBaselineProduct(product)
  }

  // When Next.js <Activity> hides this route on Back/navigation, increment visitKey
  // so reopening the route mounts a fresh form instance from the saved baselineProduct.
  useLayoutEffect(() => {
    return () => {
      setVisitKey((k) => k + 1)
    }
  }, [])

  return (
    <ProductFormInner
      key={`${baselineProduct?.id ?? "new"}-${visitKey}`}
      product={baselineProduct}
      categories={categories}
      onSaved={setBaselineProduct}
    />
  )
}

function ProductFormInner({
  product,
  categories,
  onSaved,
}: {
  product: Product | null
  categories: Pick<Category, "id" | "name">[]
  onSaved: (next: Product | null) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [slugTouched, setSlugTouched] = useState(Boolean(product))
  const [uploading, setUploading] = useState(false)
  const savedRef = useRef(false)
  const storeSettings = useStoreSettings()
  const { shopName } = storeSettings

  const form = useForm<ProductInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  })
  const { errors, isDirty } = form.formState

  const { fields: specs, append: appendSpec, remove: removeSpec } = useFieldArray({ control: form.control, name: "specs" })
  const [name, slug, description, highlightsText, seoTitle, seoDescription, weightVal, shippingClassVal] = useWatch({
    control: form.control,
    name: ["name", "slug", "description", "highlights", "seoTitle", "seoDescription", "weightGrams", "shippingClass"],
  })
  const highlightCount = String(highlightsText ?? "").split("\n").filter((l) => l.trim()).length

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    void form.handleSubmit((values) => {
      if (uploading) {
        toast.warning("Photos are still uploading. Save once they finish.")
        return
      }
      startTransition(async () => {
        const res = await saveProduct(product?.id ?? null, values, product?.stock)
        if (!res.ok) {
          toast.error(res.error)
          for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
            if (messages?.[0]) form.setError(field as keyof ProductInput, { message: messages[0] })
          }
          return
        }
        savedRef.current = true
        if (product) {
          onSaved({
            ...product,
            name: values.name,
            slug: values.slug,
            description: values.description,
            shortDescription: values.shortDescription,
            highlights: values.highlights,
            specs: values.specs,
            careInstructions: values.careInstructions,
            price: values.price,
            compareAtPrice: values.compareAtPrice,
            images: [...values.images],
            categoryId: values.categoryId,
            stock: res.data.stock,
            weightGrams: values.weightGrams,
            shippingClass: values.shippingClass,
            isActive: values.isActive,
            isFeatured: values.isFeatured,
            seoTitle: values.seoTitle ?? null,
            seoDescription: values.seoDescription ?? null,
          })
        }
        form.reset({ ...form.getValues(), stock: res.data.stock })
        later(() => toast.success(product ? "Product updated. It's live on the store." : "Product created. It's live on the store."))
        if (product && res.data.stock !== values.stock) {
          toast.info(`Stock is now ${res.data.stock} (it changed while you were editing, e.g. a new order).`)
        }
        router.push("/admin/products")
        router.refresh()
      })
    })(e)

  const previewTitle = (seoTitle as string) || `${name || "Product name"} | ${shopName}`
  const previewDesc = (seoDescription as string) || (description as string)?.slice(0, 155) || "Product description…"

  return (
    <form data-ui="admin/ProductForm" onSubmit={onSubmit} noValidate className="space-y-6">
      <div data-ui="admin/ProductForm/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        {/* ------------------------------------------------ main column */}
        <div data-ui="admin/ProductForm/div" className="min-w-0 space-y-1">
          <Section title="Basic details">
            <TextField
              label="Product name" maxLength={LIMITS.productName.max}
              fieldSize="md"
              error={errors.name?.message}
              {...form.register("name", {
                onChange: (e) => {
                  if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: false })
                },
              })}
            />
            <TextField
              label="URL slug" kind="slug"
              fieldSize="md"
              className="font-mono text-sm"
              hint={`${siteConfig.url}/products/${slug || "…"}`}
              error={errors.slug?.message}
              {...form.register("slug", { onChange: () => setSlugTouched(true) })}
            />
            <TextAreaField
              label="Full description" maxLength={LIMITS.productDescription.max}
              rows={8}
              hint="The story and details. Long text is shown with a “Read more” button, and Google reads all of it."
              error={errors.description?.message}
              {...form.register("description")}
            />
          </Section>

          <Section
            title="Product details"
            description="This is what customers read first. A good summary, a few highlights and key specs answer most questions."
          >
            <TextAreaField
              label="Short summary" maxLength={LIMITS.shortDescription.max}
              rows={2}
              hint="1–2 sentences shown right under the price. Leave blank to use the start of the description."
              error={errors.shortDescription?.message}
              {...form.register("shortDescription")}
            />
            <TextAreaField
              label="Highlights" maxLength={LIMITS.highlightsText.max}
              rows={4}
              placeholder={"Hand-poured in small batches\n100% natural soy wax\nBurns for about 40 hours"}
              hint={`One point per line, up to ${MAX_HIGHLIGHTS} (${highlightCount}/${MAX_HIGHLIGHTS}). Shown as a checklist near the price.`}
              error={errors.highlights?.message}
              {...form.register("highlights")}
            />

            <div data-ui="admin/ProductForm/div-2" className="space-y-3">
              <div data-ui="admin/ProductForm/div-3">
                <p data-ui="admin/ProductForm/p" className="text-sm font-medium">Specifications</p>
                <p data-ui="admin/ProductForm/p-2" className="text-xs text-muted-foreground">Material, size, weight, colour… shown as a table. Up to {MAX_SPECS}.</p>
              </div>
              {specs.map((field, i) => (
                <div data-ui="admin/ProductForm/div-grid-2" key={field.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[200px_1fr_auto]">
                  <TextField
                    label={`Detail ${i + 1} name`} maxLength={LIMITS.specLabel.max}
                    hideLabel
                    fieldSize="md"
                    placeholder="e.g. Material"
                    suggestions={SPEC_SUGGESTIONS}
                    error={errors.specs?.[i]?.label?.message}
                    {...form.register(`specs.${i}.label`)}
                  />
                  <TextField
                    label={`Detail ${i + 1} value`} maxLength={LIMITS.specValue.max}
                    hideLabel
                    fieldSize="md"
                    placeholder="e.g. Natural soy wax, glass jar"
                    containerClassName="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                    error={errors.specs?.[i]?.value?.message}
                    {...form.register(`specs.${i}.value`)}
                  />
                  <Button data-ui="admin/ProductForm/Button" type="button" variant="ghost" size="icon" aria-label={`Remove detail ${i + 1}`} onClick={() => removeSpec(i)}>
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              {errors.specs?.message && <p data-ui="admin/ProductForm/p-3" className="text-xs font-medium text-destructive">{errors.specs.message}</p>}
              {specs.length < MAX_SPECS && (
                <Button data-ui="admin/ProductForm/Button-add-a-detail" type="button" variant="outline" size="sm" className="rounded-full" onClick={() => appendSpec({ label: "", value: "" })}>
                  <PlusIcon /> Add a detail
                </Button>
              )}
            </div>

            <TextAreaField
              label="Care instructions" maxLength={LIMITS.careInstructions.max}
              rows={3}
              hint="Optional. Shown in a collapsible “Care” section."
              error={errors.careInstructions?.message}
              {...form.register("careInstructions")}
            />
          </Section>

          <Section title="Photos" description="Up to 8 photos. The first one is the cover. Good photos sell!">
            <Controller
              control={form.control}
              name="images"
              render={({ field }) => <ImageUploader savedRef={savedRef} onUploadingChange={setUploading} value={(field.value as string[]) ?? []} onChange={(update) => field.onChange(typeof update === "function" ? update((form.getValues("images") as string[]) ?? []) : update)} />}
            />
            {errors.images && <p data-ui="admin/ProductForm/p-4" className="text-xs font-medium text-destructive">{errors.images.message ?? "Invalid image"}</p>}
          </Section>

          <Section title="Search engine listing" description="How this product appears on Google. Leave blank to auto-fill.">
            <div data-ui="admin/ProductForm/div-4" className="rounded-xl border bg-background p-4">
              <p data-ui="admin/ProductForm/p-5" className="truncate text-xs text-muted-foreground">
                {siteConfig.url.replace(/^https?:\/\//, "")} › products › {slug || "…"}
              </p>
              <p data-ui="admin/ProductForm/p-6" className="mt-1 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{previewTitle}</p>
              <p data-ui="admin/ProductForm/p-7" className="line-clamp-2 text-sm text-muted-foreground">{previewDesc}</p>
            </div>
            <TextField
              label="SEO title" maxLength={LIMITS.seoTitle.max}
              fieldSize="md"
              hint={`${(seoTitle as string)?.length ?? 0}/70`}
              error={errors.seoTitle?.message}
              {...form.register("seoTitle")}
            />
            <TextAreaField
              label="SEO description" maxLength={LIMITS.seoDescription.max}
              rows={2}
              hint={`${(seoDescription as string)?.length ?? 0}/160`}
              error={errors.seoDescription?.message}
              {...form.register("seoDescription")}
            />
          </Section>
        </div>

        {/* ------------------------------------------------ side column (settings for this product) */}
        <div data-ui="admin/ProductForm/div-5" className="min-w-0 space-y-6">
          <Section title="Visibility">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <SwitchField label="Active" description="Visible in the store" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
              )}
            />
            <Controller
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <SwitchField
                  label="Featured"
                  description="Show on the home page"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Section>

          <Section title="Pricing & stock">
            <div data-ui="admin/ProductForm/div-grid-3" className="grid grid-cols-2 gap-x-4 gap-y-1">
              <TextField label="Price" kind="money" fieldSize="md" inputMode="decimal" leading="₹" error={errors.price?.message} {...form.register("price")} />
              <TextField
                label="MRP" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Optional, shows a discount"
                error={errors.compareAtPrice?.message}
                {...form.register("compareAtPrice")}
              />
            </div>
            <TextField label="Stock" kind="digits" maxLength={String(LIMITS.stock.max).length} fieldSize="md" inputMode="numeric" hint="0 = sold out" error={errors.stock?.message} {...form.register("stock")} />
            <FormSelectField
              control={form.control}
              name="categoryId"
              label="Category"
              fieldSize="md"
              placeholder="No category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Section>

          <Section
            title="Shipping & parcel"
            description="Declare the item's physical size and weight. Handling & courier slab rates are managed centrally in Settings."
          >
            <FormSelectField
              control={form.control}
              name="shippingClass"
              label="Handling & size class"
              fieldSize="md"
              options={SHIPPING_CLASS_OPTIONS}
            />
            <TextField
              label="Parcel weight (grams)"
              kind="digits"
              maxLength={String(LIMITS.weightGrams.max).length}
              fieldSize="md"
              inputMode="numeric"
              hint={
                Number(weightVal) > 0
                  ? `${formatWeightGrams(Number(weightVal))} per piece. Base delivery includes ${formatWeightGrams(storeSettings.freeWeightGrams)} per order.`
                  : "e.g. 350 for 350 g, 1500 for 1.5 kg. 0 = standard light item."
              }
              error={errors.weightGrams?.message}
              {...form.register("weightGrams")}
            />
            <p data-ui="admin/ProductForm/p-8" className="rounded-xl bg-secondary/70 p-3 text-xs text-muted-foreground">
              {shippingClassVal === "oversized"
                ? storeSettings.oversizedFee > 0
                  ? `Large / bulky handling (${formatPrice(storeSettings.oversizedFee)}) is added once per order.`
                  : "Marked as large / bulky (currently ₹0 in Settings)."
                : shippingClassVal === "fragile"
                  ? storeSettings.fragileFee > 0
                    ? `Fragile packaging (${formatPrice(storeSettings.fragileFee)}) is added once per order.`
                    : "Marked as fragile (currently ₹0 in Settings)."
                  : "Standard parcel: no special handling charge."}
            </p>
          </Section>
        </div>
      </div>

      {/* Spans the whole form, so it's obvious Save covers every section. */}
      <StickySaveBar
        dirty={isDirty}
        pending={pending}
        busy={uploading}
        requireChanges={Boolean(product)}
        saveLabel={product ? "Save changes" : "Create product"}
        onCancel={() => {
          form.reset(toFormValues(product))
          setSlugTouched(Boolean(product))
          router.back()
        }}
      />
    </form>
  )
}
