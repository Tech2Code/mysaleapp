"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTransition, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { SwitchField, TextAreaField, TextField } from "@/components/form"
import { siteConfig } from "@/config/site"
import { saveStoreSettings } from "@/features/settings/actions"
import { storeSettingsSchema, type StoreSettingsInput, type StoreSettingsValues } from "@/features/settings/schema"
import type { StoreSettings } from "@/features/settings/types"
import { formatPrice } from "@/lib/format"
import { StickySaveBar } from "./sticky-save-bar"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section data-ui="admin/Card" className="mb-6 space-y-5 break-inside-avoid rounded-2xl border bg-card p-5 sm:p-6">
      <div data-ui="admin/Card/div">
        <h2 data-ui="admin/Card/h2" className="font-sans text-lg font-semibold">{title}</h2>
        <p data-ui="admin/Card/p" className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function toFormValues(s: StoreSettings): StoreSettingsInput {
  return {
    shopName: s.shopName,
    tagline: s.tagline,
    description: s.description,
    keywords: s.keywords.join(", "),
    announcement: s.announcement ?? "",
    whatsappNumber: s.whatsappNumber,
    phoneSameAsWhatsapp: s.phoneSameAsWhatsapp,
    email: s.email ?? "",
    // when the numbers are the same the saved calling number is not used, so show an empty field
    phone: s.phoneSameAsWhatsapp ? "" : (s.phone ?? ""),
    city: s.city ?? "",
    region: s.region ?? "",
    instagramUrl: s.instagramUrl ?? "",
    facebookUrl: s.facebookUrl ?? "",
    orderCodePrefix: s.orderCodePrefix,
    unpaidOrderExpiryHours: s.unpaidOrderExpiryHours,
    returnWindowDays: s.returnWindowDays,
    deliveryFee: s.deliveryFee,
    freeDeliveryAbove: s.freeDeliveryAbove,
    upiId: s.upiId ?? "",
    upiPayeeName: s.upiPayeeName ?? "",
  }
}

/**
 * Everything the owner can change without touching code.
 * Two columns on wide screens so no side is left empty; one save bar covers the whole page.
 */
export function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const form = useForm<StoreSettingsInput, unknown, StoreSettingsValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: toFormValues(settings),
  })
  const { errors, isDirty } = form.formState
  const [fee, freeAbove, prefix, description, name, phoneSame] = useWatch({
    control: form.control,
    name: ["deliveryFee", "freeDeliveryAbove", "orderCodePrefix", "description", "shopName", "phoneSameAsWhatsapp"],
  })

  const feeNum = Number(fee)
  const freeNum = Number(freeAbove)
  const deliveryPreview =
    Number.isFinite(feeNum) && Number.isFinite(freeNum) && String(fee) !== "" && String(freeAbove) !== ""
      ? freeNum > 0
        ? `Customers pay ${formatPrice(feeNum)} for delivery. Orders of ${formatPrice(freeNum)} or more get free delivery (the fee shows crossed out).`
        : `Customers pay ${formatPrice(feeNum)} for delivery on every order.`
      : null

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveStoreSettings(values)
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof StoreSettingsInput, { message: messages[0] })
        }
        return
      }
      toast.success("Settings saved. Your website is updated.")
      // keep exactly what was saved (normalised phone number, upper-case prefix…) as the new baseline
      form.reset({
        shopName: values.shopName,
        tagline: values.tagline,
        description: values.description,
        keywords: values.keywords,
        announcement: values.announcement ?? "",
        whatsappNumber: values.whatsappNumber,
        phoneSameAsWhatsapp: values.phoneSameAsWhatsapp,
        email: values.email ?? "",
        phone: values.phoneSameAsWhatsapp ? "" : (values.phone ?? ""),
        city: values.city ?? "",
        region: values.region ?? "",
        instagramUrl: values.instagramUrl ?? "",
        facebookUrl: values.facebookUrl ?? "",
        orderCodePrefix: values.orderCodePrefix,
        unpaidOrderExpiryHours: values.unpaidOrderExpiryHours,
        returnWindowDays: values.returnWindowDays,
        deliveryFee: values.deliveryFee,
        freeDeliveryAbove: values.freeDeliveryAbove,
        upiId: values.upiId ?? "",
        upiPayeeName: values.upiPayeeName ?? "",
      })
      router.refresh()
    })
  )

  return (
    <form data-ui="admin/StoreSettingsForm" onSubmit={onSubmit} noValidate>
      <div data-ui="admin/StoreSettingsForm/div" className="xl:columns-2 xl:gap-6">
        {/* ----------------------------------------------- column 1: your shop */}
        <div data-ui="admin/StoreSettingsForm/div-2" className="contents">
          <Card
            title="Shop profile"
            description="Your name and tagline appear in the header, the browser tab, Google results and WhatsApp share previews."
          >
            <div data-ui="admin/StoreSettingsForm/div-grid" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <TextField label="Shop name" maxLength={LIMITS.shopName.max} fieldSize="md" error={errors.shopName?.message} {...form.register("shopName")} />
              <TextField label="Tagline" maxLength={LIMITS.tagline.max} fieldSize="md" error={errors.tagline?.message} {...form.register("tagline")} />
            </div>
            <TextAreaField
              label="Description" maxLength={LIMITS.shopDescription.max}
              rows={3}
              hint={`${String(description ?? "").length}/300. Shown on Google and in the footer. Aim for about 150 characters.`}
              error={errors.description?.message}
              {...form.register("description")}
            />
            <TextAreaField
              label="Announcement banner" maxLength={LIMITS.announcement.max}
              rows={2}
              hint="Optional. One line shown at the top of every page, e.g. “Diwali sale: free delivery on all orders”. Leave empty to hide it."
              error={errors.announcement?.message}
              {...form.register("announcement")}
            />
          </Card>

          <Card title="Social links" description="Shown in the footer and on the Contact page. Paste the full link.">
            <div data-ui="admin/StoreSettingsForm/div-grid-2" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <TextField
                label="Instagram" kind="url"
                fieldSize="md"
                type="url"
                placeholder="https://instagram.com/yourshop"
                error={errors.instagramUrl?.message}
                {...form.register("instagramUrl")}
              />
              <TextField
                label="Facebook" kind="url"
                fieldSize="md"
                type="url"
                placeholder="https://facebook.com/yourshop"
                error={errors.facebookUrl?.message}
                {...form.register("facebookUrl")}
              />
            </div>
          </Card>

          <Card
            title="Google & SEO"
            description="Helps people find your shop by name or by what you sell. Your website address comes from the deployment settings, not from here."
          >
            <TextAreaField
              label="Search keywords" maxLength={LIMITS.keywords.max}
              rows={2}
              hint="Separate with commas, e.g. handmade gifts, home decor, scented candles."
              error={errors.keywords?.message}
              {...form.register("keywords")}
            />
            <div data-ui="admin/StoreSettingsForm/div-3" className="rounded-xl border bg-background p-4">
              <p data-ui="admin/StoreSettingsForm/p" className="truncate text-xs text-muted-foreground">{siteConfig.url.replace(/^https?:\/\//, "")}</p>
              <p data-ui="admin/StoreSettingsForm/p-2" className="mt-1 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{String(name ?? "")}</p>
              <p data-ui="admin/StoreSettingsForm/p-3" className="line-clamp-2 text-sm text-muted-foreground">{String(description ?? "")}</p>
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------- column 2: contact, money, orders */}
        <div data-ui="admin/StoreSettingsForm/div-4" className="contents">
          <Card title="Contact & WhatsApp" description="Used on the Contact page, the footer, the WhatsApp button and every WhatsApp message.">
            <TextField
              label="WhatsApp number" kind="intlPhone"
              fieldSize="md"
              type="tel"
              inputMode="tel"
              leading="+"
              hint="Your 10-digit number is fine (91 is added for you). All “chat on WhatsApp” links open this number."
              error={errors.whatsappNumber?.message}
              {...form.register("whatsappNumber")}
            />
            <Controller
              control={form.control}
              name="phoneSameAsWhatsapp"
              render={({ field }) => (
                <SwitchField
                  label="Customers can call me on the same number"
                  description="Turn off if your calling number is different from your WhatsApp number."
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {!phoneSame && (
              <TextField
                label="Calling number" kind="displayPhone"
                fieldSize="md"
                type="tel"
                inputMode="tel"
                placeholder="+91 98765 43210"
                hint="Shown on the Contact page with a “Call now” button."
                error={errors.phone?.message}
                {...form.register("phone")}
              />
            )}
            <div data-ui="admin/StoreSettingsForm/div-grid-3" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <TextField label="Email" kind="email" fieldSize="md" type="email" error={errors.email?.message} {...form.register("email")} />
              <TextField label="City" kind="city" fieldSize="md" error={errors.city?.message} {...form.register("city")} />
              <TextField label="State" maxLength={LIMITS.region.max} fieldSize="md" error={errors.region?.message} {...form.register("region")} />
            </div>
            <p data-ui="admin/StoreSettingsForm/p-4" className="text-xs text-muted-foreground">Anything you leave empty is simply hidden on the website.</p>
          </Card>

          <Card
            title="Payment (UPI)"
            description="Customers pay this UPI ID after placing an order, then enter the UTR. You verify it in your UPI/bank app and confirm the order. Cash on delivery isn't offered."
          >
            <div data-ui="admin/StoreSettingsForm/div-grid-4" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <TextField
                label="UPI ID" kind="upiId"
                fieldSize="md"
                placeholder="yourshop@okhdfcbank"
                autoCapitalize="none"
                autoComplete="off"
                hint="Shown on the payment screen and used in the QR code."
                error={errors.upiId?.message}
                {...form.register("upiId")}
              />
              <TextField
                label="Name shown in the UPI app" maxLength={LIMITS.payeeName.max}
                fieldSize="md"
                placeholder="e.g. Kalakriti"
                hint="Should match your UPI account name."
                error={errors.upiPayeeName?.message}
                {...form.register("upiPayeeName")}
              />
            </div>
          </Card>

          <Card title="Delivery charges" description="Applied to every order. Per-product charges (like handling) are set on each product.">
            <div data-ui="admin/StoreSettingsForm/div-grid-5" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <TextField
                label="Delivery charge" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Flat fee on every order. Use 0 for always-free delivery."
                error={errors.deliveryFee?.message}
                {...form.register("deliveryFee")}
              />
              <TextField
                label="Free delivery on orders above" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Use 0 to never offer free delivery."
                error={errors.freeDeliveryAbove?.message}
                {...form.register("freeDeliveryAbove")}
              />
            </div>
            {deliveryPreview && <p data-ui="admin/StoreSettingsForm/p-5" className="rounded-xl bg-secondary/70 p-3 text-sm">{deliveryPreview}</p>}
          </Card>

          <Card title="Orders" description="How your order numbers look, and how long an unpaid order is kept, and the return window.">
            <TextField
              label="Order code prefix" kind="orderPrefix"
              fieldSize="md"
              className="font-mono uppercase"
              maxLength={5}
              containerClassName="sm:w-64"
              hint={`New orders look like ${String(prefix || "KK").toUpperCase()}-7F3K9Q. Existing orders keep their code.`}
              error={errors.orderCodePrefix?.message}
              {...form.register("orderCodePrefix")}
            />
            <TextField
              label="Cancel unpaid orders after (hours)" kind="digits"
              fieldSize="md"
              inputMode="numeric"
              maxLength={3}
              containerClassName="sm:w-64"
              hint="Frees the reserved stock if nobody pays. 0 = never. Orders where the customer already sent a UTR are never auto-cancelled."
              error={errors.unpaidOrderExpiryHours?.message}
              {...form.register("unpaidOrderExpiryHours")}
            />
            <TextField
              label="Return window (days after delivery)" kind="digits"
              fieldSize="md"
              inputMode="numeric"
              maxLength={2}
              containerClassName="sm:w-64"
              hint="How long customers can request a return. 0 = returns are not accepted."
              error={errors.returnWindowDays?.message}
              {...form.register("returnWindowDays")}
            />
          </Card>
        </div>
      </div>

      <StickySaveBar dirty={isDirty} pending={pending} saveLabel="Save settings" />
    </form>
  )
}
