"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  EyeIcon,
  FileTextIcon,
  ImageIcon,
  IndianRupeeIcon,
  LayersIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { Button } from "@/components/ui/button"
import { VariantMatrixModal, type VariantFormRow } from "./variant-matrix-modal"
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
import { cn } from "@/lib/utils"
import { ImageUploader } from "./image-uploader"
import { StickySaveBar } from "./sticky-save-bar"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-views.module.css"

function hasDirtyValue(val: unknown): boolean {
  if (val === true) return true
  if (Array.isArray(val)) return val.some(hasDirtyValue)
  if (val && typeof val === "object") return Object.values(val).some(hasDirtyValue)
  return false
}

function hasDirty(dirtyFields: Record<string, unknown>, ...keys: (keyof ProductInput)[]): boolean {
  return keys.some((k) => hasDirtyValue(dirtyFields[k]))
}

function Section({
  title,
  description,
  icon: Icon,
  dirty = false,
  children,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  dirty?: boolean
  children: ReactNode
}) {
  return (
    <section

      className={cn("adminCard", styles.sectionCard, dirty && styles.sectionCardDirty)}
    >
      <div
        className={cn(styles.sectionHeader, dirty && styles.sectionHeaderDirty)}
      >
        <div className={styles.sectionHeaderLeft}>
          {Icon && (
            <span
              className={cn(styles.sectionIconBox, dirty && styles.sectionIconBoxDirty)}
            >
              <Icon className={styles.iconMd} aria-hidden />
            </span>
          )}
          <div className={styles.sectionTitleGroup}>
            <h2 className={styles.sectionTitle}>
              {title}
            </h2>
            {description && (
              <p className={styles.sectionDesc}>
                {description}
              </p>
            )}
          </div>
        </div>
        {dirty && (
          <span className={styles.editedPill}>
            <span className={styles.editedDot} aria-hidden />
            Edited
          </span>
        )}
      </div>
      <div className={styles.sectionBody}>
        {children}
      </div>
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
    variants: (product?.variants ?? []).map((vr) => ({
      id: vr.id,
      label: vr.label,
      ...(vr.options ? { options: vr.options } : {}),
      price: vr.price,
      compareAtPrice: vr.compareAtPrice ?? "",
      stock: vr.stock,
      sku: vr.sku ?? "",
    })),
    careInstructions: product?.careInstructions ?? "",
    reviewAspects: (product?.reviewAspects ?? []).join(", "),
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? "",
    images: product?.images ? [...product.images] : [],
    categoryId: product?.categoryId ?? "",
    stock: product?.stock ?? 10,
    weightGrams: product?.weightGrams ?? 0,
    shippingClass: product?.shippingClass ?? "standard",
    returnWindowDays: product?.returnWindowDays == null ? "" : String(product.returnWindowDays),
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
  const { errors, isDirty, dirtyFields } = form.formState
  const df = dirtyFields as Record<string, unknown>
  const basicDirty = hasDirty(df, "name", "slug", "description")
  const detailsDirty = hasDirty(df, "shortDescription", "highlights", "specs", "careInstructions", "reviewAspects")
  const photosDirty = hasDirty(df, "images")
  const seoDirty = hasDirty(df, "seoTitle", "seoDescription")
  const visibilityDirty = hasDirty(df, "isActive", "isFeatured")
  const pricingDirty = hasDirty(df, "price", "compareAtPrice", "stock", "categoryId", "variants")
  const shippingDirty = hasDirty(df, "shippingClass", "weightGrams", "returnWindowDays")

  const { fields: specs, append: appendSpec, remove: removeSpec } = useFieldArray({ control: form.control, name: "specs" })
  const { fields: variants, replace: replaceVariants, remove: removeVariant } = useFieldArray({ control: form.control, name: "variants" })
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [name, slug, description, highlightsText, seoTitle, seoDescription, weightVal, shippingClassVal, returnWindowVal, basePriceVal, watchedVariants] = useWatch({
    control: form.control,
    name: ["name", "slug", "description", "highlights", "seoTitle", "seoDescription", "weightGrams", "shippingClass", "returnWindowDays", "price", "variants"],
  })
  const hasVariants = Array.isArray(watchedVariants) && watchedVariants.length > 0
  const variantsTotalStock = hasVariants
    ? watchedVariants.reduce((sum, vr) => sum + (Number.isFinite(Number(vr?.stock)) ? Math.max(0, Math.trunc(Number(vr?.stock))) : 0), 0)
    : 0
  const variantPrices = hasVariants
    ? watchedVariants.map((vr) => Number(vr?.price)).filter((n) => Number.isFinite(n) && n >= 1)
    : []
  const variantMinPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0
  const variantMaxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0

  const syncBaseFromVariants = (nextList: { price?: unknown; compareAtPrice?: unknown; stock?: unknown }[]) => {
    if (nextList.length === 0) return
    const total = nextList.reduce((sum, vr) => sum + (Number.isFinite(Number(vr?.stock)) ? Math.max(0, Math.trunc(Number(vr?.stock))) : 0), 0)
    const inStock = nextList.filter((vr) => Number(vr?.stock) > 0)
    const pool = inStock.length > 0 ? inStock : nextList
    const lowest = pool.reduce((best, cur) => (Number(cur?.price) < Number(best?.price) ? cur : best), pool[0])
    const lowestPrice = Number(lowest?.price)
    if (Number.isFinite(lowestPrice) && lowestPrice >= 1) {
      form.setValue("price", lowestPrice, { shouldDirty: false })
      const lowestCompare = lowest?.compareAtPrice === "" || lowest?.compareAtPrice == null ? "" : Number(lowest.compareAtPrice)
      form.setValue("compareAtPrice", typeof lowestCompare === "number" && Number.isFinite(lowestCompare) && lowestCompare > lowestPrice ? lowestCompare : "", { shouldDirty: false })
    }
    form.setValue("stock", total, { shouldDirty: false })
  }

  const handleSaveMatrix = (nextRows: VariantFormRow[]) => {
    replaceVariants(nextRows)
    syncBaseFromVariants(nextRows)
  }

  const handleRemoveVariant = (index: number) => {
    const nextList = (Array.isArray(watchedVariants) ? watchedVariants : []).filter((_, idx) => idx !== index)
    removeVariant(index)
    syncBaseFromVariants(nextList)
  }
  const highlightCount = String(highlightsText ?? "").split("\n").filter((l) => l.trim()).length

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    void form.handleSubmit((values) => {
      if (uploading) {
        toast.warning("Photos are still uploading. Save once they finish.")
        return
      }
      startTransition(async () => {
        const expectedVariantStocks = product?.variants?.length
          ? Object.fromEntries(product.variants.map((vr) => [vr.id, vr.stock]))
          : undefined
        const res = await saveProduct(product?.id ?? null, values, product?.stock, expectedVariantStocks)
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
            variants: values.variants.map((vr) => ({
              id: vr.id,
              label: vr.label,
              ...(vr.options && Object.keys(vr.options).length > 0 ? { options: vr.options } : {}),
              price: vr.price,
              compareAtPrice: vr.compareAtPrice ?? null,
              stock: vr.stock,
              sku: vr.sku ?? null,
            })),
            careInstructions: values.careInstructions,
            price: values.price,
            compareAtPrice: values.compareAtPrice,
            images: [...values.images],
            categoryId: values.categoryId,
            stock: res.data.stock,
            weightGrams: values.weightGrams,
            shippingClass: values.shippingClass,
            returnWindowDays: values.returnWindowDays ?? null,
            reviewAspects: values.reviewAspects,
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
    <form onSubmit={onSubmit} noValidate className={styles.formStack}>
      <div className={styles.productFormGrid}>
        {/* ------------------------------------------------ main column */}
        <div className={styles.formColumn}>
          <Section title="Basic details" description="Title, storefront link and product story." icon={FileTextIcon} dirty={basicDirty}>
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
              className={styles.monoInput}
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
            icon={ListChecksIcon}
            dirty={detailsDirty}
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

            <div className={styles.specsBlock}>
              <div>
                <p className={styles.specsTitle}>Specifications</p>
                <p className={styles.specsSub}>Material, size, weight, colour… shown as a table. Up to {MAX_SPECS}.</p>
              </div>
              {specs.map((field, i) => (
                <div key={field.id} className={styles.specRow}>
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
                    containerClassName={styles.specValueCol}
                    error={errors.specs?.[i]?.value?.message}
                    {...form.register(`specs.${i}.value`)}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove detail ${i + 1}`} onClick={() => removeSpec(i)}>
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              {errors.specs?.message && <p className={styles.errorText}>{errors.specs.message}</p>}
              {specs.length < MAX_SPECS && (
                <Button type="button" variant="outline" size="sm" className={styles.pillBtn} onClick={() => appendSpec({ label: "", value: "" })}>
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
            <TextField
              label="Review aspects override"
              fieldSize="md"
              maxLength={400}
              placeholder="e.g. Fragrance, Burn Time, Jar Quality"
              hint="Optional comma-separated options for “Why do you love it?” (up to 8). Leave blank to use the category's aspects."
              error={errors.reviewAspects?.message}
              {...form.register("reviewAspects")}
            />
          </Section>

          <Section title="Photos" description="Up to 8 photos. The first one is the cover. Good photos sell!" icon={ImageIcon} dirty={photosDirty}>
            <Controller
              control={form.control}
              name="images"
              render={({ field }) => <ImageUploader savedRef={savedRef} onUploadingChange={setUploading} value={(field.value as string[]) ?? []} onChange={(update) => field.onChange(typeof update === "function" ? update((form.getValues("images") as string[]) ?? []) : update)} />}
            />
            {errors.images && <p className={styles.errorText}>{errors.images.message ?? "Invalid image"}</p>}
          </Section>

          <Section title="Search engine listing" description="How this product appears on Google. Leave blank to auto-fill." icon={SearchIcon} dirty={seoDirty}>
            <div className={styles.seoPreviewBox}>
              <p className={styles.seoUrl}>
                {siteConfig.url.replace(/^https?:\/\//, "")} › products › {slug || "…"}
              </p>
              <p className={styles.seoTitle}>{previewTitle}</p>
              <p className={styles.seoDesc}>{previewDesc}</p>
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
        <div className={styles.formColumn}>
          <Section title="Visibility" description="Control store and homepage placement." icon={EyeIcon} dirty={visibilityDirty}>
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

          <Section title="Pricing & stock" description={hasVariants ? "Auto-calculated from your product options below." : "Selling price, MRP, inventory & category."} icon={IndianRupeeIcon} dirty={pricingDirty}>
            {hasVariants ? (
              <div className={styles.variantSyncedPricingCard}>
                <div className={styles.variantSyncedRow}>
                  <span className={styles.variantSyncedLabel}>Price range</span>
                  <span className={styles.variantSyncedValue}>
                    {variantMinPrice === variantMaxPrice
                      ? formatPrice(variantMinPrice)
                      : `${formatPrice(variantMinPrice)} – ${formatPrice(variantMaxPrice)}`}
                  </span>
                </div>
                <div className={styles.variantSyncedRow}>
                  <span className={styles.variantSyncedLabel}>Total stock</span>
                  <span className={styles.variantSyncedValue}>
                    {variantsTotalStock} across {variants.length} option{variants.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className={styles.variantSyncedHint}>
                  Pricing and inventory are controlled per option in <strong>Variants &amp; options</strong> below. Remove all options to switch back to a single price.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.priceGrid}>
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
                <TextField
                  label="Stock"
                  kind="digits"
                  maxLength={String(LIMITS.stock.max).length}
                  fieldSize="md"
                  inputMode="numeric"
                  hint="0 = sold out"
                  error={errors.stock?.message}
                  {...form.register("stock")}
                />
              </>
            )}
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
            title="Variants & options (optional)"
            description="Color × Size, Storage × Color, or Weight options with separate prices & stock."
            icon={LayersIcon}
            dirty={hasDirty(df, "variants")}
          >
            {variants.length === 0 ? (
              <div className={styles.variantsEmptyCard}>
                <p className={styles.variantsEmptyTitle}>Single-option product</p>
                <p className={styles.variantsEmptySub}>
                  Set up options like Color and Size — all combinations are generated automatically in one matrix.
                </p>
                <Button type="button" variant="outline" size="sm" className={styles.variantAddBtn} onClick={() => setVariantModalOpen(true)}>
                  <PlusIcon className={styles.iconSm} /> Set up variants
                </Button>
              </div>
            ) : (
              <div className={styles.variantsStack}>
                <ul className={styles.variantSummaryList}>
                  {variants.map((field, index) => {
                    const row = watchedVariants?.[index]
                    const label = row?.label || `Option ${index + 1}`
                    const price = Number(row?.price ?? 0)
                    const compareAt = row?.compareAtPrice ? Number(row.compareAtPrice) : null
                    const stock = Number(row?.stock ?? 0)
                    const skuText = typeof row?.sku === "string" && row.sku.trim() ? row.sku.trim() : null
                    return (
                      <li key={field.id} className={styles.variantSummaryItem}>
                        <button
                          type="button"
                          onClick={() => setVariantModalOpen(true)}
                          className={styles.variantSummaryMainBtn}
                        >
                          <span className={styles.variantSummaryTop}>
                            <span className={styles.variantSummaryLabel}>{label}</span>
                            <span className={cn(styles.variantStockTag, stock <= 0 ? styles.variantStockOut : styles.variantStockIn)}>
                              {stock <= 0 ? "Sold out" : `${stock} in stock`}
                            </span>
                          </span>
                          <span className={styles.variantSummaryMeta}>
                            <span className={styles.variantPriceMono}>{formatPrice(price)}</span>
                            {compareAt && compareAt > price && (
                              <span className={styles.variantCompareMono}>{formatPrice(compareAt)}</span>
                            )}
                            {skuText && <span className={styles.variantSkuTag}>SKU: {skuText}</span>}
                          </span>
                        </button>
                        <div className={styles.variantSummaryActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Manage ${label}`}
                            onClick={() => setVariantModalOpen(true)}
                          >
                            <PencilIcon className={styles.iconSm} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${label}`}
                            onClick={() => handleRemoveVariant(index)}
                            className={styles.variantDeleteIconBtn}
                          >
                            <Trash2Icon className={styles.iconSm} />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <div className={styles.variantFooterBar}>
                  <span className={styles.variantTotalSummary}>
                    <strong>{variantsTotalStock}</strong> total stock · {variants.length} combination{variants.length === 1 ? "" : "s"}
                  </span>
                  <Button type="button" variant="outline" size="sm" className={styles.pillBtn} onClick={() => setVariantModalOpen(true)}>
                    <PencilIcon className={styles.iconSm} /> Manage variants
                  </Button>
                </div>
              </div>
            )}
          </Section>

          <Section
            title="Shipping, parcel & returns"
            description="Declare the item's physical size, weight, and return window. Leave the return window blank to use the store default."
            icon={TruckIcon}
            dirty={shippingDirty}
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
            <TextField
              label="Return & exchange window (days)"
              kind="digits"
              maxLength={2}
              fieldSize="md"
              inputMode="numeric"
              placeholder={`Store default (${storeSettings.returnWindowDays} days)`}
              hint={
                returnWindowVal === "" || returnWindowVal === null || returnWindowVal === undefined
                  ? `Uses store default (${storeSettings.returnWindowDays} days). Enter 0 to make this product non-returnable.`
                  : Number(returnWindowVal) === 0
                    ? "0 = Non-returnable item (no return or exchange allowed after delivery)."
                    : `Custom window: ${Number(returnWindowVal)} ${Number(returnWindowVal) === 1 ? "day" : "days"} after delivery for this product.`
              }
              error={errors.returnWindowDays?.message}
              {...form.register("returnWindowDays")}
            />
            <p className={styles.shippingNote}>
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

      <VariantMatrixModal
        open={variantModalOpen}
        onOpenChange={setVariantModalOpen}
        initialVariants={
          Array.isArray(watchedVariants)
            ? watchedVariants.map((vr) => ({
                id: String(vr?.id ?? ""),
                label: String(vr?.label ?? ""),
                ...(vr?.options ? { options: vr.options } : {}),
                price: vr?.price == null ? "" : (vr.price as number | string),
                compareAtPrice: vr?.compareAtPrice == null ? "" : (vr.compareAtPrice as number | string),
                stock: vr?.stock == null ? 0 : (vr.stock as number | string),
                sku: typeof vr?.sku === "string" ? vr.sku : "",
              }))
            : []
        }
        defaultPrice={Number(basePriceVal) >= 1 ? Number(basePriceVal) : 499}
        onSave={handleSaveMatrix}
      />

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
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back()
          } else {
            router.push("/admin/products")
          }
        }}
      />
    </form>
  )
}
