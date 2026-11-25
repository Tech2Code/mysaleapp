"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  BadgePercentIcon,
  CopyIcon,
  GlobeIcon,
  IndianRupeeIcon,
  Loader2Icon,
  PhoneIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  TicketPercentIcon,
  Trash2Icon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useState, useTransition, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DateField, FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { siteConfig } from "@/config/site"
import { matchState, STATE_OPTIONS } from "@/features/location/states"
import { createPromoCode, deletePromoCode, saveStoreSettings, togglePromoCode } from "@/features/settings/actions"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"
import {
  createPromoCodeSchema,
  storeSettingsSchema,
  type CreatePromoCodeInput,
  type CreatePromoCodeValues,
  type StoreSettingsInput,
  type StoreSettingsValues,
} from "@/features/settings/schema"
import type { PromoCode, StoreSettings } from "@/features/settings/types"
import { PAYMENT_GATEWAY_LABEL, PAYMENT_GATEWAY_PROVIDERS, type PaymentGatewayProvider } from "@/features/orders/types"
import { formatWeightGrams } from "@/features/orders/pricing"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StickySaveBar } from "./sticky-save-bar"
import { LIMITS, todayIST } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-views.module.css"

function hasDirtyValue(val: unknown): boolean {
  if (val === true) return true
  if (Array.isArray(val)) return val.some(hasDirtyValue)
  if (val && typeof val === "object") return Object.values(val).some(hasDirtyValue)
  return false
}

function hasDirty(dirtyFields: Record<string, unknown>, ...keys: (keyof StoreSettingsInput)[]): boolean {
  return keys.some((k) => hasDirtyValue(dirtyFields[k]))
}

function Card({
  title,
  description,
  icon: Icon,
  dirty = false,
  children,
}: {
  title: string
  description: string
  icon?: LucideIcon
  dirty?: boolean
  children: ReactNode
}) {
  return (
    <section

      className={cn("adminCard", styles.sectionCard, styles.settingsCard, dirty && styles.sectionCardDirty)}
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
            <p className={styles.sectionDesc}>
              {description}
            </p>
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

function toFormValues(s: StoreSettings): StoreSettingsInput {
  return {
    shopName: s.shopName,
    tagline: s.tagline,
    description: s.description,
    keywords: s.keywords.join(", "),
    announcement: s.announcement ?? "",
    highlightLine: s.highlightLine,
    heroBadge: s.heroBadge,
    priceNote: s.priceNote ?? "",
    gstRegistered: s.gstRegistered,
    gstin: s.gstin ?? "",
    gstRate: s.gstRate,
    legalName: s.legalName ?? "",
    businessAddress: s.businessAddress ?? "",
    whatsappNumber: s.whatsappNumber,
    phoneSameAsWhatsapp: s.phoneSameAsWhatsapp,
    email: s.email ?? "",
    // when the numbers are the same the saved calling number is not used, so show an empty field
    phone: s.phoneSameAsWhatsapp ? "" : (s.phone ?? ""),
    city: s.city ?? "",
    region: s.region ? (matchState(s.region) ?? s.region) : "",
    instagramUrl: s.instagramUrl ?? "",
    facebookUrl: s.facebookUrl ?? "",
    orderCodePrefix: s.orderCodePrefix,
    unpaidOrderExpiryHours: s.unpaidOrderExpiryHours,
    returnWindowDays: s.returnWindowDays,
    deliveryFee: s.deliveryFee,
    freeDeliveryAbove: s.freeDeliveryAbove,
    fragileFee: s.fragileFee,
    oversizedFee: s.oversizedFee,
    freeWeightGrams: s.freeWeightGrams,
    extraWeightFeePerKg: s.extraWeightFeePerKg,
    paymentMode: s.paymentMode,
    paymentGateway: s.paymentGateway,
    upiId: s.upiId ?? "",
    upiPayeeName: s.upiPayeeName ?? "",
  }
}

const PAYMENT_MODE_OPTIONS = [
  { value: "manual_upi", label: "Direct UPI (₹0 fee · manual UTR verification)" },
  { value: "gateway", label: "Payment Gateway (Auto-verified online checkout)" },
]

const PAYMENT_GATEWAY_OPTIONS = PAYMENT_GATEWAY_PROVIDERS.map((p) => ({
  value: p,
  label: PAYMENT_GATEWAY_LABEL[p],
}))

/**
 * Everything the owner can change without touching code.
 * Two columns on wide screens so no side is left empty; one save bar covers the whole page.
 */
export function StoreSettingsForm({
  settings,
  configuredGateways = [],
}: {
  settings: StoreSettings
  configuredGateways?: PaymentGatewayProvider[]
}) {
  const [visitKey, setVisitKey] = useState(0)
  const [baseline, setBaseline] = useState<StoreSettingsInput>(() => toFormValues(settings))
  const [prevSettings, setPrevSettings] = useState(settings)

  if (settings !== prevSettings) {
    setPrevSettings(settings)
    setBaseline(toFormValues(settings))
  }

  useLayoutEffect(() => {
    return () => {
      setVisitKey((k) => k + 1)
    }
  }, [])

  return <StoreSettingsFormInner key={visitKey} baseline={baseline} onSaved={setBaseline} configuredGateways={configuredGateways} />
}

function StoreSettingsFormInner({
  baseline,
  onSaved,
  configuredGateways,
}: {
  baseline: StoreSettingsInput
  onSaved: (next: StoreSettingsInput) => void
  configuredGateways: PaymentGatewayProvider[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const form = useForm<StoreSettingsInput, unknown, StoreSettingsValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: baseline,
  })
  const { errors, isDirty, dirtyFields } = form.formState
  const df = dirtyFields as Record<string, unknown>
  const shopDirty = hasDirty(df, "shopName", "tagline", "description", "announcement", "highlightLine", "heroBadge")
  const socialDirty = hasDirty(df, "instagramUrl", "facebookUrl")
  const seoDirty = hasDirty(df, "keywords")
  const contactDirty = hasDirty(df, "whatsappNumber", "phoneSameAsWhatsapp", "phone", "email", "city", "region")
  const paymentDirty = hasDirty(df, "paymentMode", "paymentGateway", "upiId", "upiPayeeName")
  const taxDirty = hasDirty(df, "gstRegistered", "gstRate", "gstin", "priceNote", "legalName", "businessAddress")
  const deliveryDirty = hasDirty(df, "deliveryFee", "freeDeliveryAbove", "fragileFee", "oversizedFee", "freeWeightGrams", "extraWeightFeePerKg")
  const ordersDirty = hasDirty(df, "orderCodePrefix", "unpaidOrderExpiryHours", "returnWindowDays")
  const [pincode, setPincode] = useState("")
  const [fee, freeAbove, fragileFee, oversizedFee, freeWeightGrams, extraWeightFeePerKg, prefix, description, name, phoneSame, gstOn, regionVal, paymentModeNow, paymentGatewayNow] = useWatch({
    control: form.control,
    name: [
      "deliveryFee",
      "freeDeliveryAbove",
      "fragileFee",
      "oversizedFee",
      "freeWeightGrams",
      "extraWeightFeePerKg",
      "orderCodePrefix",
      "description",
      "shopName",
      "phoneSameAsWhatsapp",
      "gstRegistered",
      "region",
      "paymentMode",
      "paymentGateway",
    ],
  })

  const area = usePincodeLookup({
    pincode,
    overwrite: true,
    getCity: () => String(form.getValues("city") ?? ""),
    setCity: (city) => form.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => String(form.getValues("region") ?? ""),
    setState: (state) => form.setValue("region", state, { shouldValidate: true, shouldDirty: true }),
  })
  const regionStr = typeof regionVal === "string" ? regionVal.trim() : ""
  const stateOptions =
    regionStr && !STATE_OPTIONS.some((o) => o.value === regionStr)
      ? [{ value: regionStr, label: regionStr }, ...STATE_OPTIONS]
      : STATE_OPTIONS

  const feeNum = Number(fee)
  const freeNum = Number(freeAbove)
  const fragileNum = Number(fragileFee)
  const oversizedNum = Number(oversizedFee)
  const freeWeightNum = Number(freeWeightGrams)
  const extraWeightNum = Number(extraWeightFeePerKg)
  const smartExtras = [
    Number.isFinite(fragileNum) && fragileNum > 0 ? `${formatPrice(fragileNum)} fragile packaging (once/order)` : null,
    Number.isFinite(oversizedNum) && oversizedNum > 0 ? `${formatPrice(oversizedNum)} bulky handling (once/order)` : null,
    Number.isFinite(extraWeightNum) && extraWeightNum > 0
      ? `${formatPrice(extraWeightNum)}/kg above ${formatWeightGrams(Number.isFinite(freeWeightNum) ? freeWeightNum : 0)}`
      : null,
  ].filter(Boolean)
  const deliveryPreview =
    Number.isFinite(feeNum) && Number.isFinite(freeNum) && String(fee) !== "" && String(freeAbove) !== ""
      ? [
          freeNum > 0
            ? `Standard delivery: ${formatPrice(feeNum)} (free on orders of ${formatPrice(freeNum)}+).`
            : `Standard delivery: ${formatPrice(feeNum)} on every order.`,
          smartExtras.length > 0 ? `Smart surcharges: ${smartExtras.join(" · ")}.` : "No extra handling or weight surcharges.",
        ].join(" ")
      : null

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    void form.handleSubmit((values) =>
      startTransition(async () => {
        const res = await saveStoreSettings(values)
        if (!res.ok) {
          toast.error(res.error)
          for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
            if (messages?.[0] && field in values) form.setError(field as keyof StoreSettingsInput, { message: messages[0] })
          }
          return
        }
        later(() => toast.success("Settings saved. Your website is updated."))
        // keep exactly what was saved (normalised phone number, upper-case prefix…) as the new baseline
        const nextBaseline: StoreSettingsInput = {
          shopName: values.shopName,
          tagline: values.tagline,
          description: values.description,
          keywords: values.keywords,
          announcement: values.announcement ?? "",
          highlightLine: values.highlightLine ?? DEFAULT_SETTINGS.highlightLine,
          heroBadge: values.heroBadge ?? DEFAULT_SETTINGS.heroBadge,
          priceNote: values.priceNote ?? "",
          gstRegistered: values.gstRegistered,
          gstin: values.gstin ?? "",
          gstRate: values.gstRate,
          legalName: values.legalName ?? "",
          businessAddress: values.businessAddress ?? "",
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
          fragileFee: values.fragileFee,
          oversizedFee: values.oversizedFee,
          freeWeightGrams: values.freeWeightGrams,
          extraWeightFeePerKg: values.extraWeightFeePerKg,
          paymentMode: values.paymentMode,
          paymentGateway: values.paymentGateway,
          upiId: values.upiId ?? "",
          upiPayeeName: values.upiPayeeName ?? "",
        }
        onSaved(nextBaseline)
        setPincode("")
        form.reset(nextBaseline)
        router.refresh()
      })
    )(e)

  return (
    <form onSubmit={onSubmit} noValidate className={styles.formStack}>
      <div className={styles.settingsColumns}>
        {/* ----------------------------------------------- column 1: your shop */}
        <div className={styles.contentsGroup}>
          <Card
            title="Shop profile"
            description="Your name and tagline appear in the header, the browser tab, Google results and WhatsApp share previews."
            icon={StoreIcon}
            dirty={shopDirty}
          >
            <div className={styles.twoColFields}>
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
            <div className={styles.twoColFields}>
              <TextField
                label="Product page highlight" maxLength={LIMITS.highlightText.max} fieldSize="md"
                hint="Short line with an icon on every product page. Leave empty for the default."
                error={errors.highlightLine?.message}
                {...form.register("highlightLine")}
              />
              <TextField
                label="Home page badge" maxLength={LIMITS.highlightText.max} fieldSize="md"
                hint="Small badge above the home headline. Leave empty for the default."
                error={errors.heroBadge?.message}
                {...form.register("heroBadge")}
              />
            </div>
          </Card>

          <Card title="Social links" description="Shown in the footer and on the Contact page. Paste the full link." icon={GlobeIcon} dirty={socialDirty}>
            <div className={styles.twoColFields}>
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
            icon={BadgePercentIcon}
            dirty={seoDirty}
          >
            <TextAreaField
              label="Search keywords" maxLength={LIMITS.keywords.max}
              rows={2}
              hint="Separate with commas, e.g. handmade gifts, home decor, scented candles."
              error={errors.keywords?.message}
              {...form.register("keywords")}
            />
            <div className={styles.seoCardPreview}>
              <p className={styles.seoUrl}>{siteConfig.url.replace(/^https?:\/\//, "")}</p>
              <p className={styles.seoTitle}>{String(name ?? "")}</p>
              <p className={styles.seoDesc}>{String(description ?? "")}</p>
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------- column 2: contact, money, orders */}
        <div className={styles.contentsGroup}>
          <Card title="Contact & WhatsApp" description="Used on the Contact page, the footer, the WhatsApp button and every WhatsApp message." icon={PhoneIcon} dirty={contactDirty}>
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
            <div className={styles.twoColFields}>
              <TextField label="Email" kind="email" fieldSize="md" type="email" error={errors.email?.message} {...form.register("email")} />
              <TextField
                label="Pincode"
                kind="pincode"
                fieldSize="md"
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 302001"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                hint={area.hint}
                error={area.error}
              />
              <TextField label="City / District" kind="city" fieldSize="md" error={errors.city?.message} {...form.register("city")} />
              <FormSelectField
                control={form.control}
                name="region"
                label="State"
                fieldSize="md"
                placeholder="Select state"
                options={stateOptions}
              />
            </div>
            <p className={styles.mutedHintText}>Anything you leave empty is simply hidden on the website.</p>
          </Card>

          <Card
            title="Payment (UPI)"
            description="Direct UPI keeps fees at ₹0 with manual UTR verification. Switch to Payment Gateway anytime once your gateway API keys are configured in environment variables."
            icon={IndianRupeeIcon}
            dirty={paymentDirty}
          >
            <div className={styles.twoColFields}>
              <FormSelectField
                control={form.control}
                name="paymentMode"
                label="Checkout payment mode"
                fieldSize="md"
                options={PAYMENT_MODE_OPTIONS}
                error={errors.paymentMode?.message}
              />
              {paymentModeNow === "gateway" && (
                <FormSelectField
                  control={form.control}
                  name="paymentGateway"
                  label="Gateway provider"
                  fieldSize="md"
                  options={PAYMENT_GATEWAY_OPTIONS}
                  error={errors.paymentGateway?.message}
                />
              )}
            </div>
            {paymentModeNow === "gateway" && (
              <p className={styles.deliveryPreviewBox}>
                {configuredGateways.includes((paymentGatewayNow ?? "razorpay") as PaymentGatewayProvider)
                  ? `${PAYMENT_GATEWAY_LABEL[(paymentGatewayNow ?? "razorpay") as PaymentGatewayProvider]} server keys are configured and ready for auto-verified online payments.`
                  : `${PAYMENT_GATEWAY_LABEL[(paymentGatewayNow ?? "razorpay") as PaymentGatewayProvider]} server keys are not configured in environment variables yet. See payment-gateway-setup.md before enabling Gateway mode.`}
              </p>
            )}
            <div className={styles.twoColFields}>
              <TextField
                label="UPI ID" kind="upiId"
                fieldSize="md"
                placeholder="yourshop@okhdfcbank"
                autoCapitalize="none"
                autoComplete="off"
                hint={paymentModeNow === "gateway" ? "Optional fallback / refund reference UPI ID." : "Shown on the payment screen and used in the QR code."}
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

          <Card
            title="Tax & invoices"
            description="Not registered for GST? Leave this off: invoices are a Bill of Supply and no tax is shown. After you get a GSTIN, turn it on to switch to Tax Invoices."
            icon={ReceiptIcon}
            dirty={taxDirty}
          >
            <Controller
              control={form.control}
              name="gstRegistered"
              render={({ field }) => (
                <SwitchField
                  label="I am registered under GST"
                  description="Prices you enter are treated as already including GST."
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {gstOn && (
              <div className={styles.twoColFields}>
                <TextField
                  label="GSTIN" kind="gstin" fieldSize="md"
                  placeholder="22AAAAA0000A1Z5"
                  autoCapitalize="characters"
                  autoComplete="off"
                  error={errors.gstin?.message}
                  {...form.register("gstin")}
                />
                <TextField
                  label="GST rate included in prices (%)" fieldSize="md"
                  kind="money"
                  maxLength={5}
                  placeholder="12"
                  hint="One rate for every product, e.g. 5, 12 or 18. Ask your CA which applies."
                  error={errors.gstRate?.message}
                  {...form.register("gstRate")}
                />
              </div>
            )}
            <TextField
              label="Price note" maxLength={LIMITS.priceNote.max} fieldSize="md"
              placeholder={gstOn ? "Inclusive of all taxes" : "Optional"}
              hint={gstOn ? "Shown under the price. Leave empty to use “Inclusive of all taxes”." : "Shown under the price on product pages. Leave empty to show nothing."}
              error={errors.priceNote?.message}
              {...form.register("priceNote")}
            />
            <div className={styles.twoColFields}>
              <TextField
                label="Name on invoices" maxLength={LIMITS.legalName.max} fieldSize="md"
                hint="Leave empty to use your shop name."
                error={errors.legalName?.message}
                {...form.register("legalName")}
              />
              <TextAreaField
                label="Address on invoices" maxLength={LIMITS.businessAddress.max}
                rows={2}
                hint="Leave empty to use your city and state."
                error={errors.businessAddress?.message}
                {...form.register("businessAddress")}
              />
            </div>
          </Card>

          <Card
            title="Delivery & handling charges"
            description="Centralised courier & packaging rules. Products only declare their weight and handling class — rates apply automatically per order."
            icon={TruckIcon}
            dirty={deliveryDirty}
          >
            <div className={styles.twoColFields}>
              <TextField
                label="Standard delivery charge" kind="money"
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
                hint="Waives standard delivery. Use 0 to never offer free delivery."
                error={errors.freeDeliveryAbove?.message}
                {...form.register("freeDeliveryAbove")}
              />
            </div>
            <div className={styles.twoColFields}>
              <TextField
                label="Fragile packaging fee" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Added once per order when any item is Fragile. 0 = free."
                error={errors.fragileFee?.message}
                {...form.register("fragileFee")}
              />
              <TextField
                label="Large / bulky handling fee" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Added once per order for Large / bulky items (replaces fragile fee if higher). 0 = free."
                error={errors.oversizedFee?.message}
                {...form.register("oversizedFee")}
              />
            </div>
            <div className={styles.twoColFields}>
              <TextField
                label="Included parcel weight (grams)" kind="digits"
                fieldSize="md"
                inputMode="numeric"
                maxLength={String(LIMITS.weightGrams.max).length}
                hint="Total order weight covered by base delivery (e.g. 1000 = 1 kg)."
                error={errors.freeWeightGrams?.message}
                {...form.register("freeWeightGrams")}
              />
              <TextField
                label="Heavy parcel rate (per extra kg)" kind="money"
                fieldSize="md"
                inputMode="decimal"
                leading="₹"
                hint="Charged per started 1 kg above included weight. 0 = off."
                error={errors.extraWeightFeePerKg?.message}
                {...form.register("extraWeightFeePerKg")}
              />
            </div>
            {deliveryPreview && <p className={styles.deliveryPreviewBox}>{deliveryPreview}</p>}
          </Card>

          <Card title="Orders" description="Order code format, rejected-UTR expiry, and the return window." icon={ShoppingCartIcon} dirty={ordersDirty}>
            <div className={styles.ordersFieldsGrid}>
              <TextField
                label="Order code prefix" kind="orderPrefix"
                fieldSize="md"
                className={styles.monoUpperInput}
                maxLength={5}
                hint={`Preview: ${String(prefix || "KK").toUpperCase()}-7F3K9Q. Existing orders keep their code.`}
                error={errors.orderCodePrefix?.message}
                {...form.register("orderCodePrefix")}
              />
              <TextField
                label="Auto-cancel rejected UTR (hours)" kind="digits"
                fieldSize="md"
                inputMode="numeric"
                maxLength={3}
                hint="Time before an un-updated rejected UTR is cancelled and stock is released. 0 = never."
                error={errors.unpaidOrderExpiryHours?.message}
                {...form.register("unpaidOrderExpiryHours")}
              />
              <TextField
                label="Return & exchange window (days)" kind="digits"
                fieldSize="md"
                inputMode="numeric"
                maxLength={2}
                containerClassName={styles.returnWindowCol}
                hint="Days after delivery to request a return or exchange (max 90). 0 = off."
                error={errors.returnWindowDays?.message}
                {...form.register("returnWindowDays")}
              />
            </div>
          </Card>
        </div>
      </div>

      <StickySaveBar
        dirty={isDirty}
        pending={pending}
        saveLabel="Save settings"
        onCancel={() => {
          form.reset(baseline)
          setPincode("")
        }}
      />
    </form>
  )
}

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percent", label: "Percentage off (%)" },
  { value: "flat", label: "Flat discount (₹)" },
]

export function PromoCodeManager({ promoCodes }: { promoCodes: PromoCode[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null)
  const [pending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [today, setToday] = useState<string | undefined>(undefined)
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  useEffect(() => {
    const nowDay = todayIST()
    queueMicrotask(() => setToday(nowDay))
  }, [])

  const form = useForm<CreatePromoCodeInput, unknown, CreatePromoCodeValues>({
    resolver: zodResolver(createPromoCodeSchema),
    defaultValues: {
      code: "",
      description: "",
      discountType: "percent",
      discountValue: 10,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      maxUses: null,
      expiresAt: null,
    },
  })
  const { errors } = form.formState
  const discountType = useWatch({ control: form.control, name: "discountType" })
  const expiresAtVal = useWatch({ control: form.control, name: "expiresAt" })

  useEffect(() => {
    if (discountType === "flat") {
      form.setValue("maxDiscountAmount", null)
      form.clearErrors("maxDiscountAmount")
    }
  }, [discountType, form])

  useLayoutEffect(() => {
    return () => {
      setCreateOpen(false)
      setDeleteTarget(null)
      form.reset()
    }
  }, [form])

  const onCreateSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await createPromoCode(values)
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) {
            form.setError(field as keyof CreatePromoCodeInput, { message: messages[0] })
          }
        }
        return
      }
      later(() => {
        setCreateOpen(false)
        form.reset({
          code: "",
          description: "",
          discountType: "percent",
          discountValue: 10,
          minOrderAmount: 0,
          maxDiscountAmount: null,
          maxUses: null,
          expiresAt: null,
        })
        toast.success(`Promo code ${values.code} created.`)
      })
      router.refresh()
    })
  })

  const handleToggle = (promo: PromoCode, nextActive: boolean) => {
    setTogglingId(promo.id)
    startTransition(async () => {
      const res = await togglePromoCode({ id: promo.id, isActive: nextActive })
      setTogglingId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => toast.success(`${promo.code} ${nextActive ? "enabled" : "disabled"}.`))
      router.refresh()
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deletePromoCode({ id: target.id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setDeleteTarget(null)
        toast.success(`Promo code ${target.code} deleted.`)
      })
      router.refresh()
    })
  }

  return (
    <section className={styles.promoSection}>
      <div className={styles.promoHeader}>
        <div>
          <h2 className={styles.promoTitle}>
            <TicketPercentIcon className={styles.promoTitleIcon} aria-hidden />
            Promo codes &amp; discount coupons
          </h2>
          <p className={styles.promoSub}>
            Create discount codes for sales or festive offers. Toggle codes on or off anytime without deleting them.
          </p>
        </div>
        <Button

          type="button"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className={styles.newPromoBtn}
        >
          <PlusIcon className={styles.iconMd} /> New promo code
        </Button>
      </div>

      {promoCodes.length === 0 ? (
        <div className={styles.promoEmpty}>
          <p className={styles.promoEmptyTitle}>No promo codes yet</p>
          <p className={styles.promoEmptySub}>
            Create a code like <span className={styles.codeExample}>WELCOME10</span> or <span className={styles.codeExample}>DIWALI100</span> so customers can apply it at checkout.
          </p>
        </div>
      ) : (
        <div className={styles.promoGrid}>
          {promoCodes.map((promo) => {
            const isExpired = Boolean(today && promo.expiresAt && promo.expiresAt < today)
            const isLimitReached = Boolean(promo.maxUses !== null && promo.usedCount >= promo.maxUses)
            const effectiveStatus = !promo.isActive
              ? { label: "Disabled", tone: styles.statusDisabled }
              : isExpired
                ? { label: "Expired", tone: styles.statusExpired }
                : isLimitReached
                  ? { label: "Limit reached", tone: styles.statusLimit }
                  : { label: "Active", tone: styles.statusActive }

            const discountSummary =
              promo.discountType === "percent"
                ? `${promo.discountValue}% OFF${promo.maxDiscountAmount ? ` (up to ${formatPrice(promo.maxDiscountAmount)})` : ""}`
                : `${formatPrice(promo.discountValue)} OFF`

            return (
              <div

                key={promo.id}
                className={cn(
                  styles.promoCard,
                  promo.isActive && !isExpired && !isLimitReached ? styles.promoCardActive : styles.promoCardInactive
                )}
              >
                <div className={styles.promoCardTop}>
                  <div className={styles.promoCardInfo}>
                    <div className={styles.promoTagRow}>
                      <span className={styles.promoCodeTag}>
                        {promo.code}
                      </span>
                      <button

                        type="button"
                        aria-label={`Copy promo code ${promo.code}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(promo.code)
                            toast.success(`Copied ${promo.code}`)
                          } catch {
                            toast.error("Could not copy code")
                          }
                        }}
                        className={styles.copyBtn}
                      >
                        <CopyIcon className={styles.iconSm} />
                      </button>
                      <span

                        className={cn(styles.statusPill, effectiveStatus.tone)}
                      >
                        {effectiveStatus.label}
                      </span>
                    </div>
                    <p className={styles.promoDiscountText}>
                      {discountSummary}
                      {promo.minOrderAmount > 0 ? ` · Min order ${formatPrice(promo.minOrderAmount)}` : " · No min order"}
                    </p>
                    {promo.description && (
                      <p className={styles.promoDescText}>{promo.description}</p>
                    )}
                  </div>

                  <button

                    type="button"
                    aria-label={`Delete promo code ${promo.code}`}
                    disabled={pending}
                    onClick={() => setDeleteTarget(promo)}
                    className={styles.deletePromoBtn}
                  >
                    <Trash2Icon className={styles.iconMd} />
                  </button>
                </div>

                <div className={styles.promoCardBottom}>
                  <div className={styles.promoUsageMeta}>
                    <span className={styles.promoUsedCount}>
                      Used: {promo.usedCount}
                      {promo.maxUses !== null ? ` / ${promo.maxUses}` : " (unlimited)"}
                    </span>
                    {promo.expiresAt && (
                      <span>
                        {isExpired ? "Expired" : "Expires"} {formatDate(`${promo.expiresAt}T00:00:00+05:30`)}
                      </span>
                    )}
                  </div>

                  <div className={styles.promoActions}>
                    <Button

                      type="button"
                      variant={promo.isActive ? "outline" : "default"}
                      size="xs"
                      disabled={pending}
                      onClick={() => handleToggle(promo, !promo.isActive)}
                      className={styles.togglePromoBtn}
                    >
                      {togglingId === promo.id && <Loader2Icon className={cn(styles.iconXs, styles.spinIcon)} />}
                      {promo.isActive ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (pending) return
          if (!next) {
            form.reset()
            form.clearErrors()
          }
          setCreateOpen(next)
        }}
      >
        <DialogContent mobileFullScreen className={styles.dialogLgMax}>
          <DialogHeader showCloseButton={!pending}>
            <DialogTitle>Create promo code</DialogTitle>
            <DialogDescription>
              Customers can apply this code at checkout. You can disable or delete it anytime.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} noValidate className={styles.dialogForm}>
            <DialogBody className={styles.dialogBodySpace4}>
              <div className={styles.dialogTwoCol}>
                <TextField
                  label="Promo code"
                  fieldSize="md"
                  placeholder="e.g. WELCOME10"
                  maxLength={24}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={styles.monoUpperInput}
                  hint="3–24 letters, numbers, - or _"
                  error={errors.code?.message}
                  {...form.register("code")}
                />
                <FormSelectField
                  control={form.control}
                  name="discountType"
                  label="Discount type"
                  fieldSize="md"
                  options={DISCOUNT_TYPE_OPTIONS}
                />
              </div>

              <div className={styles.dialogTwoCol}>
                <TextField
                  label={discountType === "percent" ? "Discount percentage (%)" : "Flat discount amount (₹)"}
                  kind="money"
                  fieldSize="md"
                  inputMode="decimal"
                  leading={discountType === "flat" ? "₹" : undefined}
                  placeholder={discountType === "percent" ? "10" : "100"}
                  hint={discountType === "percent" ? "Between 1% and 90%" : "Amount subtracted from items total"}
                  error={errors.discountValue?.message}
                  {...form.register("discountValue")}
                />
                <TextField
                  label="Minimum order amount (₹)"
                  kind="money"
                  fieldSize="md"
                  inputMode="decimal"
                  leading="₹"
                  placeholder="499"
                  hint="0 = works on any order amount"
                  error={errors.minOrderAmount?.message}
                  {...form.register("minOrderAmount")}
                />
              </div>

              <div className={styles.dialogTwoCol}>
                {discountType === "percent" && (
                  <TextField
                    label="Max discount cap (optional)"
                    kind="money"
                    fieldSize="md"
                    inputMode="decimal"
                    leading="₹"
                    placeholder="e.g. 250"
                    hint="Leave blank for no cap"
                    error={errors.maxDiscountAmount?.message}
                    {...form.register("maxDiscountAmount")}
                  />
                )}
                <TextField
                  label="Total usage limit (optional)"
                  kind="digits"
                  fieldSize="md"
                  inputMode="numeric"
                  placeholder="e.g. 100"
                  hint="Leave blank for unlimited uses"
                  error={errors.maxUses?.message}
                  {...form.register("maxUses")}
                />
                <DateField
                  label="Expiry date (optional)"
                  fieldSize="md"
                  min={today}
                  value={typeof expiresAtVal === "string" ? expiresAtVal : ""}
                  onChange={(next) => form.setValue("expiresAt", next || null, { shouldValidate: true, shouldDirty: true })}
                  hint="Valid through the end of this date"
                  error={errors.expiresAt?.message}
                />
              </div>

              <TextField
                label="Short offer description (optional)"
                fieldSize="md"
                maxLength={140}
                placeholder="e.g. Festive special — 10% off on handmade gifts"
                hint="Shown to the customer when they apply the code at checkout"
                error={errors.description?.message}
                {...form.register("description")}
              />
            </DialogBody>
            <DialogFooter>
              <Button

                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  form.reset()
                  form.clearErrors()
                  setCreateOpen(false)
                }}
                className={styles.pillBtn}
              >
                Cancel
              </Button>
              <Button

                type="submit"
                disabled={pending}
                className={styles.createSubmitBtn}
              >
                {pending && <Loader2Icon className={styles.spinIcon} />}
                Create promo code
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && !pending && setDeleteTarget(null)}
        title={`Delete promo code ${deleteTarget?.code ?? ""}?`}
        description={
          <>
            Customers will no longer be able to use <strong className={styles.monoStrong}>{deleteTarget?.code}</strong>. Past orders that used this code keep their discount history.
          </>
        }
        confirmLabel="Delete promo code"
        cancelLabel="Cancel"
        destructive
        pending={pending}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}
