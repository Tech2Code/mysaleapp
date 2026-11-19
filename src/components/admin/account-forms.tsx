"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRoundIcon, Loader2Icon, LockIcon, MailCheckIcon, ShieldOffIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useState, useTransition, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { notifyAdminPinChanged } from "@/components/admin/admin-account-menu"
import { TextField } from "@/components/form"
import { applyClientProfileUpdate } from "@/components/shared/auth-listener"
import { Button } from "@/components/ui/button"
import {
  changeAdminPassword,
  changeAdminPin,
  disableAdminPin,
  lockAdminScreen,
  requestAdminEmailChange,
  setAdminPin,
  updateAdminProfile,
} from "@/features/auth/account-actions"
import {
  changePasswordSchema,
  emailSchema,
  profileSchema,
  setPinSchema,
  type AdminPinStatus,
} from "@/features/auth/account-schema"
import type { ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section data-ui="admin/Card" className="mb-6 space-y-4 break-inside-avoid rounded-2xl border bg-card p-4 sm:space-y-5 sm:p-6">
      <div data-ui="admin/Card/div">
        <h2 data-ui="admin/Card/h2" className="font-sans text-lg font-semibold">{title}</h2>
        <p data-ui="admin/Card/p" className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** Run a server action; show field errors from the server next to the fields. */
function useSubmit<T extends Record<string, string>>(setError: (name: keyof T & string, message: string) => void) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const run = (action: () => Promise<ActionResult>, onOk: () => void) =>
    startTransition(async () => {
      const res = await action()
      if (res.ok) return onOk()
      for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) if (msgs?.[0]) setError(field as keyof T & string, msgs[0])
      toast.error(res.error)
    })
  return { pending, run, later }
}

type ProfileValues = z.input<typeof profileSchema>

function ProfileForm({ name, phone, onSaved }: { name: string; phone: string; onSaved: (next: { name: string; phone: string }) => void }) {
  const router = useRouter()
  const [saved, setSaved] = useState({ name, phone })
  const form = useForm<ProfileValues, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name, phone },
  })
  const { errors } = form.formState
  const nameVal = useWatch({ control: form.control, name: "name" })
  const phoneVal = useWatch({ control: form.control, name: "phone" })
  const phoneStr = typeof phoneVal === "string" ? phoneVal : ""
  const { pending, run, later } = useSubmit<{ name: string; phone: string }>((n, m) => form.setError(n, { message: m }))

  const hasChanges =
    (nameVal ?? "").trim() !== saved.name.trim() ||
    (normalizeIndianPhone(phoneStr) ?? phoneStr.trim()) !== (normalizeIndianPhone(saved.phone) ?? saved.phone.trim())

  return (
    <form
      data-ui="admin/ProfileForm"
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit((values) => {
        if (!hasChanges) return
        run(
          () => updateAdminProfile(values),
          () => {
            const nextSaved = { name: values.name, phone: values.phone ?? "" }
            setSaved(nextSaved)
            onSaved(nextSaved)
            if (nextSaved.name.trim()) {
              applyClientProfileUpdate({ name: nextSaved.name.trim() })
            }
            later(() => toast.success("Details saved"))
            form.reset(nextSaved)
            router.refresh()
          }
        )
      })}
    >
      <div data-ui="admin/ProfileForm/div-grid" className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <TextField label="Your name" kind="personName" fieldSize="md" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
        <TextField label="Mobile number (optional)" kind="phone" fieldSize="md" leading="+91" error={errors.phone?.message} {...form.register("phone")} />
      </div>
      <Button data-ui="admin/ProfileForm/Button-save-details" type="submit" disabled={!hasChanges || pending} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Save details
      </Button>
    </form>
  )
}

function EmailForm({ email }: { email: string }) {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [callbackBanner, setCallbackBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const form = useForm<z.input<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })
  const { errors } = form.formState
  const emailVal = useWatch({ control: form.control, name: "email" })
  const { pending, run, later } = useSubmit<{ email: string }>((n, m) => form.setError(n, { message: m }))
  const cleanEmail = (emailVal ?? "").trim().toLowerCase()
  const emailUnchanged = !cleanEmail || cleanEmail === email.trim().toLowerCase()

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const searchParams = new URLSearchParams(window.location.search)
    const errorDesc = hashParams.get("error_description") ?? searchParams.get("error_description")
    const stepMessage = hashParams.get("message") ?? searchParams.get("message")
    const emailChanged = searchParams.get("email_changed") === "1" || (!errorDesc && hashParams.get("type") === "email_change")

    if (!errorDesc && !stepMessage && !emailChanged) return

    window.history.replaceState(null, "", window.location.pathname)

    if (errorDesc) {
      const text = errorDesc.replace(/\+/g, " ")
      queueMicrotask(() => setCallbackBanner({ tone: "error", text }))
      toast.error(text)
      return
    }

    if (emailChanged) {
      const text = "Your login email address has been updated."
      queueMicrotask(() => setCallbackBanner({ tone: "success", text }))
      toast.success("Email address updated")
      router.refresh()
      return
    }

    if (stepMessage) {
      const isTwoStep = stepMessage.toLowerCase().includes("other email")
      const text = isTwoStep
        ? "First confirmation link accepted! Please also open your other email inbox (current or new email) and click the second confirmation link to finish changing your email."
        : stepMessage.replace(/\+/g, " ")
      queueMicrotask(() => setCallbackBanner({ tone: "success", text }))
      toast.success(isTwoStep ? "Step 1 confirmed — check your other email inbox to finish" : text)
    }
  }, [router])

  return (
    <form
      data-ui="admin/EmailForm"
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        if (emailUnchanged) return
        run(
          () => requestAdminEmailChange(values),
          () => {
            setCallbackBanner(null)
            setSentTo(values.email)
            later(() => toast.success("Confirmation email sent"))
            form.reset()
          }
        )
      })}
    >
      <p data-ui="admin/EmailForm/p" className="text-sm wrap-anywhere">
        Signed in as <span data-ui="admin/EmailForm/span" className="font-semibold">{email}</span>
      </p>
      <TextField label="New email address" kind="email" fieldSize="md" error={errors.email?.message} {...form.register("email")} />
      {callbackBanner && (
        <p
          data-ui="admin/EmailForm/p-2"
          role="status"
          className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
            callbackBanner.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10"
          }`}
        >
          <MailCheckIcon className={`mt-0.5 size-4 shrink-0 ${callbackBanner.tone === "error" ? "text-destructive" : "text-success"}`} aria-hidden />
          <span data-ui="admin/EmailForm/span-2">{callbackBanner.text}</span>
        </p>
      )}
      {sentTo && (
        <p data-ui="admin/EmailForm/p-flex" role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span data-ui="admin/EmailForm/span-3">
            We sent a confirmation link to <span data-ui="admin/EmailForm/span-4" className="font-semibold">{sentTo}</span> (and to{" "}
            <span data-ui="admin/EmailForm/span-5" className="font-semibold">{email}</span> if double confirmation is enabled). Open the link(s) to finish. Until then you keep signing in with{" "}
            {email}.
          </span>
        </p>
      )}
      <Button data-ui="admin/EmailForm/Button-change-email" type="submit" variant="outline" disabled={pending || emailUnchanged} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Change email
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [resetCount, setResetCount] = useState(0)
  const form = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  })
  const { errors } = form.formState
  const [currentVal, nextVal, confirmVal] = useWatch({ control: form.control, name: ["current", "next", "confirm"] })
  const { pending, run, later } = useSubmit<{ current: string; next: string; confirm: string }>((n, m) => form.setError(n, { message: m }))
  const canSubmitPassword = Boolean(currentVal && nextVal && confirmVal && currentVal !== nextVal)

  return (
    <form
      key={resetCount}
      data-ui="admin/PasswordForm"
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit((values) =>
        run(
          () => changeAdminPassword(values),
          () => {
            later(() => toast.success("Password changed"))
            form.reset()
            setResetCount((c) => c + 1)
          }
        )
      )}
    >
      <TextField
        label="Current password"
        type="password"
        fieldSize="md"
        autoComplete="current-password"
        maxLength={LIMITS.password.max}
        error={errors.current?.message}
        {...form.register("current")}
      />
      <div data-ui="admin/PasswordForm/div-grid" className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <TextField
          label="New password"
          type="password"
          fieldSize="md"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          hint={`At least ${LIMITS.newPassword.min} characters, with a letter and a number.`}
          error={errors.next?.message}
          {...form.register("next")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          fieldSize="md"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          error={errors.confirm?.message}
          {...form.register("confirm")}
        />
      </div>
      <Button data-ui="admin/PasswordForm/Button-change-password" type="submit" variant="outline" disabled={pending || !canSubmitPassword} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Change password
      </Button>
    </form>
  )
}

/** Quick 4-digit PIN lock management: set, change/reset (via PIN or password), lock screen now, or disable ("Don't use PIN"). */
function PinLockForm({ initialStatus }: { initialStatus?: AdminPinStatus }) {
  const router = useRouter()
  const [status, setStatus] = useState<AdminPinStatus>(
    () =>
      initialStatus ?? {
        mode: "unset",
        hasPin: false,
        updatedAt: null,
        lockedUntil: null,
        unlockedAt: 0,
        manualLock: false,
      }
  )
  const [prevInitial, setPrevInitial] = useState(initialStatus)
  if (initialStatus && initialStatus !== prevInitial) {
    setPrevInitial(initialStatus)
    setStatus(initialStatus)
  }

  // Keep in sync if PIN state changes from the top-right modal
  useEffect(() => {
    const onPinSync = (e: Event) => {
      const detail = (e as CustomEvent<Partial<AdminPinStatus>>).detail
      if (!detail) return
      setStatus((prev) => ({ ...prev, ...detail }))
    }
    window.addEventListener("kk-admin-pin-changed", onPinSync)
    return () => window.removeEventListener("kk-admin-pin-changed", onPinSync)
  }, [])

  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  // State when mode !== "enabled" (setting a new PIN)
  const setForm = useForm<z.input<typeof setPinSchema>>({
    resolver: zodResolver(setPinSchema),
    defaultValues: { pin: "", confirm: "" },
  })
  const [setPinVal, setConfirmVal] = useWatch({ control: setForm.control, name: ["pin", "confirm"] })

  // State when mode === "enabled" (changing or turning off PIN)
  const [pinResetCount, setPinResetCount] = useState(0)
  const [authMethod, setAuthMethod] = useState<"pin" | "password">("pin")
  const [verifySecret, setVerifySecret] = useState("")
  const [nextPin, setNextPin] = useState("")
  const [confirmNextPin, setConfirmNextPin] = useState("")
  const [manageError, setManageError] = useState<string | null>(null)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)

  const isEnabled = status.mode === "enabled" && status.hasPin

  const handleSetPin = setForm.handleSubmit((values) => {
    startTransition(async () => {
      const res = await setAdminPin(values)
      if (!res.ok) {
        for (const [f, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) setForm.setError(f as "pin" | "confirm", { message: msgs[0] })
        }
        toast.error(res.error)
        return
      }
      const next: Partial<AdminPinStatus> = {
        mode: "enabled",
        hasPin: true,
        unlockedAt: res.data.unlockedAt,
        manualLock: false,
      }
      setStatus((prev) => ({ ...prev, ...next }))
      notifyAdminPinChanged(next)
      setForm.reset()
      later(() => toast.success("4-digit PIN enabled"))
      router.refresh()
    })
  })

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault()
    if (authMethod === "pin" && !/^\d{4}$/.test(verifySecret)) {
      setManageError("Enter your current 4-digit PIN")
      return
    }
    if (authMethod === "password" && verifySecret.length < 6) {
      setManageError("Enter your account password")
      return
    }
    if (!/^\d{4}$/.test(nextPin)) {
      setManageError("Enter a new 4-digit PIN")
      return
    }
    if (nextPin !== confirmNextPin) {
      setManageError("New PINs don't match")
      return
    }
    setManageError(null)
    startTransition(async () => {
      const res = await changeAdminPin({
        authMethod,
        currentPin: authMethod === "pin" ? verifySecret : undefined,
        password: authMethod === "password" ? verifySecret : undefined,
        next: nextPin,
        confirm: confirmNextPin,
      })
      if (!res.ok) {
        const msg =
          res.fieldErrors?.currentPin?.[0] ??
          res.fieldErrors?.password?.[0] ??
          res.fieldErrors?.next?.[0] ??
          res.fieldErrors?.confirm?.[0] ??
          res.error
        setManageError(msg)
        toast.error(msg)
        return
      }
      const next: Partial<AdminPinStatus> = {
        mode: "enabled",
        hasPin: true,
        unlockedAt: res.data.unlockedAt,
        manualLock: false,
      }
      setStatus((prev) => ({ ...prev, ...next }))
      notifyAdminPinChanged(next)
      setVerifySecret("")
      setNextPin("")
      setConfirmNextPin("")
      setPinResetCount((c) => c + 1)
      later(() => toast.success("4-digit PIN updated"))
      router.refresh()
    })
  }

  const handleDisablePin = () => {
    if (isEnabled) {
      if (authMethod === "pin" && !/^\d{4}$/.test(verifySecret)) {
        setManageError("Enter your current 4-digit PIN first to turn off PIN lock")
        return
      }
      if (authMethod === "password" && verifySecret.length < 6) {
        setManageError("Enter your account password first to turn off PIN lock")
        return
      }
    }
    setManageError(null)
    startTransition(async () => {
      const res = await disableAdminPin(
        isEnabled
          ? {
              currentPin: authMethod === "pin" ? verifySecret : undefined,
              password: authMethod === "password" ? verifySecret : undefined,
            }
          : undefined
      )
      if (!res.ok) {
        const msg =
          res.fieldErrors?.currentPin?.[0] ??
          res.fieldErrors?.password?.[0] ??
          res.error
        setManageError(msg)
        toast.error(msg)
        return
      }
      const next: Partial<AdminPinStatus> = {
        mode: "disabled",
        hasPin: false,
        unlockedAt: res.data.unlockedAt,
        manualLock: false,
      }
      setStatus((prev) => ({ ...prev, ...next }))
      notifyAdminPinChanged(next)
      setVerifySecret("")
      setNextPin("")
      setConfirmNextPin("")
      setShowDisableConfirm(false)
      later(() => toast.success("PIN lock turned off"))
      router.refresh()
    })
  }

  const handleLockNow = () => {
    startTransition(async () => {
      const res = await lockAdminScreen()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      notifyAdminPinChanged({ manualLock: true, unlockedAt: 0 })
      toast.info("Admin screen locked")
    })
  }

  return (
    <div data-ui="admin/PinLockForm" className="space-y-4">
      <div data-ui="admin/PinLockForm/div-flex" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5 text-sm">
        <div data-ui="admin/PinLockForm/div-flex-2" className="flex items-center gap-2">
          {isEnabled ? (
            <KeyRoundIcon className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <ShieldOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span data-ui="admin/PinLockForm/span" className="font-medium">
            {isEnabled
              ? "Active — locks screen every 12 hours"
              : status.mode === "disabled"
                ? "Turned off — won't ask for a PIN"
                : "Not set — we'll ask once after 12 hours"}
          </span>
        </div>
        {isEnabled && (
          <Button data-ui="admin/PinLockForm/Button-lock-screen-now"
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleLockNow}
            className="rounded-full"
          >
            <LockIcon /> Lock screen now
          </Button>
        )}
      </div>

      {!isEnabled ? (
        <form data-ui="admin/PinLockForm/form" noValidate onSubmit={handleSetPin} className="space-y-3">
          <div data-ui="admin/PinLockForm/div-grid" className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <TextField
              label="New 4-digit PIN"
              kind="adminPin"
              fieldSize="md"
              placeholder="••••"
              error={setForm.formState.errors.pin?.message}
              {...setForm.register("pin")}
            />
            <TextField
              label="Confirm 4-digit PIN"
              kind="adminPin"
              fieldSize="md"
              placeholder="••••"
              error={setForm.formState.errors.confirm?.message}
              {...setForm.register("confirm")}
            />
          </div>
          <div data-ui="admin/PinLockForm/div-flex-3" className="flex flex-wrap items-center gap-2">
            <Button data-ui="admin/PinLockForm/Button-enable-4-digit-pin"
              type="submit"
              disabled={pending || (setPinVal ?? "").length !== 4 || (setConfirmVal ?? "").length !== 4}
              className="rounded-full"
            >
              {pending && <Loader2Icon className="animate-spin" />} Enable 4-digit PIN
            </Button>
            {status.mode === "unset" && (
              <Button data-ui="admin/PinLockForm/Button-don-apos-t-use-pin"
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={handleDisablePin}
                className="rounded-full"
              >
                Don&apos;t use PIN
              </Button>
            )}
          </div>
        </form>
      ) : (
        <form key={`pin-change-${pinResetCount}`} data-ui="admin/PinLockForm/form-2" noValidate onSubmit={handleChangePin} className="space-y-3">
          <div data-ui="admin/PinLockForm/div-flex-4" className="flex flex-wrap items-center justify-between gap-2">
            <span data-ui="admin/PinLockForm/span-2" className="text-xs font-medium text-muted-foreground">
              Verify with your {authMethod === "pin" ? "current PIN" : "account password"} to change or turn off PIN:
            </span>
            <button data-ui="admin/PinLockForm/button"
              type="button"
              onClick={() => {
                setAuthMethod((m) => (m === "pin" ? "password" : "pin"))
                setVerifySecret("")
                setManageError(null)
              }}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {authMethod === "pin" ? "Forgot PIN? Use account password" : "Use current 4-digit PIN instead"}
            </button>
          </div>

          {authMethod === "pin" ? (
            <TextField
              key="verify-pin"
              label="Current 4-digit PIN"
              kind="adminPin"
              fieldSize="md"
              placeholder="••••"
              value={verifySecret}
              onChange={(e) => {
                setVerifySecret(e.target.value)
                setManageError(null)
              }}
            />
          ) : (
            <TextField
              key="verify-password"
              label="Account password"
              type="password"
              fieldSize="md"
              autoComplete="current-password"
              maxLength={LIMITS.password.max}
              value={verifySecret}
              onChange={(e) => {
                setVerifySecret(e.target.value)
                setManageError(null)
              }}
            />
          )}

          {!showDisableConfirm ? (
            <>
              <div data-ui="admin/PinLockForm/div-grid-2" className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                <TextField
                  label="New 4-digit PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={nextPin}
                  onChange={(e) => {
                    setNextPin(e.target.value)
                    setManageError(null)
                  }}
                />
                <TextField
                  label="Confirm new PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={confirmNextPin}
                  onChange={(e) => {
                    setConfirmNextPin(e.target.value)
                    setManageError(null)
                  }}
                />
              </div>
              {manageError && (
                <p data-ui="admin/PinLockForm/p" role="alert" className="text-xs font-medium text-destructive">
                  {manageError}
                </p>
              )}
              <div data-ui="admin/PinLockForm/div-flex-5" className="flex flex-wrap items-center gap-2">
                <Button data-ui="admin/PinLockForm/Button-change-pin"
                  type="submit"
                  variant="outline"
                  disabled={
                    pending ||
                    !verifySecret ||
                    nextPin.length !== 4 ||
                    confirmNextPin.length !== 4
                  }
                  className="rounded-full"
                >
                  {pending && <Loader2Icon className="animate-spin" />} Change PIN
                </Button>
                <Button data-ui="admin/PinLockForm/Button-don-apos-t-use-pin-tur"
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setShowDisableConfirm(true)
                    setManageError(null)
                  }}
                  className="rounded-full text-destructive hover:text-destructive"
                >
                  Don&apos;t use PIN (Turn off)
                </Button>
              </div>
            </>
          ) : (
            <div data-ui="admin/PinLockForm/div" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
              <p data-ui="admin/PinLockForm/p-2" className="text-xs text-muted-foreground">
                Turning off Quick PIN means the admin panel will stay unlocked for your full 7-day login session without asking for a 4-digit PIN every 12 hours.{" "}
                {!verifySecret && (
                  <span data-ui="admin/PinLockForm/span-3" className="font-medium text-foreground">
                    Enter your {authMethod === "pin" ? "current 4-digit PIN" : "account password"} in the field above to confirm.
                  </span>
                )}
              </p>
              {manageError && (
                <p data-ui="admin/PinLockForm/p-3" role="alert" className="text-xs font-medium text-destructive">
                  {manageError}
                </p>
              )}
              <div data-ui="admin/PinLockForm/div-flex-6" className="flex flex-wrap items-center gap-2">
                <Button data-ui="admin/PinLockForm/Button-confirm-don-apos-t-use"
                  type="button"
                  variant="destructive"
                  disabled={pending || !verifySecret}
                  onClick={handleDisablePin}
                  className="rounded-full"
                >
                  {pending && <Loader2Icon className="animate-spin" />} Confirm: Don&apos;t use PIN
                </Button>
                <Button data-ui="admin/PinLockForm/Button-cancel"
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setShowDisableConfirm(false)
                    setManageError(null)
                  }}
                  className="rounded-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

/** Everything about the signed-in admin: details, login email, password, and 12-hour Quick PIN lock. */
export function AccountSettings({
  name,
  phone,
  email,
  pinStatus,
}: {
  name: string
  phone: string
  email: string
  pinStatus?: AdminPinStatus
}) {
  const [visitKey, setVisitKey] = useState(0)
  const [savedProfile, setSavedProfile] = useState({ name, phone })
  const [prevProps, setPrevProps] = useState({ name, phone })

  if (name !== prevProps.name || phone !== prevProps.phone) {
    setPrevProps({ name, phone })
    setSavedProfile({ name, phone })
  }

  useEffect(() => {
    applyClientProfileUpdate({ name, email })
  }, [name, email])

  useLayoutEffect(() => {
    return () => {
      setVisitKey((k) => k + 1)
    }
  }, [])

  return (
    <div data-ui="admin/AccountSettings" className="xl:columns-2 xl:gap-6">
      <Card title="Your details" description="Shown in the admin menu. Customers never see this.">
        <ProfileForm key={`profile-${visitKey}`} name={savedProfile.name} phone={savedProfile.phone} onSaved={setSavedProfile} />
      </Card>
      <Card
        title="Quick PIN lock"
        description="Your full admin sign-in lasts 7 days. Set an optional 4-digit PIN to lock the screen every 12 hours instead of signing in again."
      >
        <PinLockForm key={`pin-${visitKey}`} initialStatus={pinStatus} />
      </Card>
      <Card title="Login email" description="We email a confirmation link to the new address before it takes effect.">
        <EmailForm key={`email-${visitKey}`} email={email} />
      </Card>
      <Card title="Password" description="Forgot it instead? Use “Forgot password” on the sign-in page.">
        <PasswordForm key={`password-${visitKey}`} />
      </Card>
    </div>
  )
}
