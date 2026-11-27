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
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-core.module.css"

function Card({
  title,
  description,
  dirty = false,
  children,
}: {
  title: string
  description: string
  dirty?: boolean
  children: ReactNode
}) {
  return (
    <section

      className={cn(
        "adminCard",
        styles.accountCard,
        dirty && styles.accountCardDirty
      )}
    >
      <div

        className={cn(
          styles.accountCardHeader,
          dirty && styles.accountCardHeaderDirty
        )}
      >
        <div className={styles.cardHeaderTitleCol}>
          <h2 className={styles.cardTitle}>
            {title}
          </h2>
          <p className={styles.cardDesc}>
            {description}
          </p>
        </div>
        {dirty && (
          <span className={styles.editedPill}>
            <span className={styles.editedDot} aria-hidden />
            Edited
          </span>
        )}
      </div>
      <div className={styles.accountCardBody}>
        {children}
      </div>
    </section>
  )
}

/** Run a server action; show field errors from the server next to the fields. */
function useSubmit<T extends Record<string, string>>(setError: (name: keyof T & string, message: string) => void) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const run = <R = void,>(action: () => Promise<ActionResult<R>>, onOk: () => void) =>
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
  const [prevProps, setPrevProps] = useState({ name, phone })
  if (name !== prevProps.name || phone !== prevProps.phone) {
    setPrevProps({ name, phone })
    setSaved({ name, phone })
  }

  useEffect(() => {
    form.reset({ name: saved.name, phone: saved.phone })
  }, [form, saved.name, saved.phone])

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

      noValidate
      className={styles.formStack2}
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
      <div className={styles.twoColFormGrid}>
        <TextField label="Your name" kind="personName" fieldSize="md" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
        <TextField label="Mobile number (optional)" kind="phone" fieldSize="md" leading="+91" error={errors.phone?.message} {...form.register("phone")} />
      </div>
      <Button type="submit" disabled={!hasChanges || pending} className={styles.roundedFullBtn}>
        {pending && <Loader2Icon className={styles.spinIcon} />} Save details
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
      const lower = errorDesc.toLowerCase()
      const text =
        lower.includes("expired") || lower.includes("invalid")
          ? "That email confirmation link has expired or was already used. Please request the email change again."
          : "Could not complete the email change. Please try again."
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

    if (stepMessage && (stepMessage === "email_step_1" || /other email|confirmation link/i.test(stepMessage))) {
      const text =
        "First confirmation link accepted! Please also open your other email inbox (current or new email) and click the second confirmation link to finish changing your email."
      queueMicrotask(() => setCallbackBanner({ tone: "success", text }))
      toast.success("Step 1 confirmed — check your other email inbox to finish")
    }
  }, [router])

  useEffect(() => {
    return () => {
      form.reset({ email: "" })
      setSentTo(null)
      setCallbackBanner(null)
    }
  }, [form])

  return (
    <form

      noValidate
      className={styles.formStack4}
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
      <p className={styles.signedInLine}>
        Signed in as <span className={styles.fontSemibold}>{email}</span>
      </p>
      <TextField label="New email address" kind="email" fieldSize="md" error={errors.email?.message} {...form.register("email")} />
      {callbackBanner && (
        <p

          role="status"
          className={cn(
            styles.statusBanner,
            callbackBanner.tone === "error" ? styles.statusBannerError : styles.statusBannerSuccess
          )}
        >
          <MailCheckIcon className={cn(styles.bannerIcon, callbackBanner.tone === "error" ? styles.bannerIconError : styles.bannerIconSuccess)} aria-hidden />
          <span>{callbackBanner.text}</span>
        </p>
      )}
      {sentTo && sentTo.trim().toLowerCase() !== email.trim().toLowerCase() && (
        <p role="status" className={cn(styles.statusBanner, styles.statusBannerSuccess)}>
          <MailCheckIcon className={cn(styles.bannerIcon, styles.bannerIconSuccess)} aria-hidden />
          <span>
            We sent a confirmation link to <span className={styles.fontSemibold}>{sentTo}</span> (and to{" "}
            <span className={styles.fontSemibold}>{email}</span> if double confirmation is enabled). Open the link(s) to finish. Until then you keep signing in with{" "}
            {email}.
          </span>
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending || emailUnchanged} className={styles.roundedFullBtn}>
        {pending && <Loader2Icon className={styles.spinIcon} />} Change email
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
  useEffect(() => {
    return () => {
      form.reset({ current: "", next: "", confirm: "" })
      setResetCount((c) => c + 1)
    }
  }, [form])
  const [currentVal, nextVal, confirmVal] = useWatch({ control: form.control, name: ["current", "next", "confirm"] })
  const { pending, run, later } = useSubmit<{ current: string; next: string; confirm: string }>((n, m) => form.setError(n, { message: m }))
  const canSubmitPassword = Boolean(currentVal && nextVal && confirmVal)
  const sameAsCurrentError =
    Boolean(currentVal && nextVal && currentVal === nextVal)
      ? "New password must be different from current password"
      : undefined
  const mismatchConfirmError =
    Boolean(nextVal && confirmVal && nextVal !== confirmVal)
      ? "Passwords do not match"
      : undefined

  return (
    <form
      key={resetCount}

      noValidate
      className={styles.formStack2}
      onSubmit={form.handleSubmit((values) =>
        run(
          () => changeAdminPassword(values),
          () => {
            notifyAdminPinChanged({ unlockedAt: Date.now(), manualLock: false })
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
      <div className={styles.twoColFormGrid}>
        <TextField
          label="New password"
          type="password"
          fieldSize="md"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          hint={`At least ${LIMITS.newPassword.min} characters, with a letter and a number.`}
          error={errors.next?.message ?? sameAsCurrentError}
          {...form.register("next")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          fieldSize="md"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          error={errors.confirm?.message ?? mismatchConfirmError}
          {...form.register("confirm")}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending || !canSubmitPassword} className={styles.roundedFullBtn}>
        {pending && <Loader2Icon className={styles.spinIcon} />} Change password
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
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [nextPinError, setNextPinError] = useState<string | null>(null)
  const [confirmPinError, setConfirmPinError] = useState<string | null>(null)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)

  // Keep in sync if PIN state changes from the top-right modal or another tab
  useEffect(() => {
    const applyPatch = (detail: Partial<AdminPinStatus> | null | undefined) => {
      if (!detail) return
      setStatus((prev) => ({ ...prev, ...detail }))
      setShowDisableConfirm(false)
      setVerifySecret("")
      setVerifyError(null)
      setNextPin("")
      setConfirmNextPin("")
      setNextPinError(null)
      setConfirmPinError(null)
    }
    const onPinSync = (e: Event) => {
      applyPatch((e as CustomEvent<Partial<AdminPinStatus>>).detail)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "kk_admin_pin_sync" || !e.newValue) return
      try {
        applyPatch(JSON.parse(e.newValue) as Partial<AdminPinStatus>)
      } catch {
        // Ignore malformed storage payload
      }
    }
    window.addEventListener("kk-admin-pin-changed", onPinSync)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("kk-admin-pin-changed", onPinSync)
      window.removeEventListener("storage", onStorage)
      setForm.reset({ pin: "", confirm: "" })
      setVerifySecret("")
      setNextPin("")
      setConfirmNextPin("")
      setVerifyError(null)
      setNextPinError(null)
      setConfirmPinError(null)
      setShowDisableConfirm(false)
      setPinResetCount((c) => c + 1)
    }
  }, [setForm])

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
    setVerifyError(null)
    setNextPinError(null)
    setConfirmPinError(null)
    if (authMethod === "pin" && !/^\d{4}$/.test(verifySecret)) {
      setVerifyError("Enter your current 4-digit PIN")
      return
    }
    if (authMethod === "password" && verifySecret.length < 6) {
      setVerifyError("Enter your account password")
      return
    }
    if (!/^\d{4}$/.test(nextPin)) {
      setNextPinError("Enter a new 4-digit PIN")
      return
    }
    if (authMethod === "pin" && verifySecret === nextPin) {
      setNextPinError("New PIN must be different from current PIN")
      return
    }
    if (nextPin !== confirmNextPin) {
      setConfirmPinError("New PINs don't match")
      return
    }
    startTransition(async () => {
      const res = await changeAdminPin({
        authMethod,
        currentPin: authMethod === "pin" ? verifySecret : undefined,
        password: authMethod === "password" ? verifySecret : undefined,
        next: nextPin,
        confirm: confirmNextPin,
      })
      if (!res.ok) {
        setVerifyError(res.fieldErrors?.currentPin?.[0] ?? res.fieldErrors?.password?.[0] ?? null)
        setNextPinError(res.fieldErrors?.next?.[0] ?? null)
        setConfirmPinError(res.fieldErrors?.confirm?.[0] ?? null)
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
      setVerifySecret("")
      setNextPin("")
      setConfirmNextPin("")
      setPinResetCount((c) => c + 1)
      later(() => toast.success("4-digit PIN updated"))
      router.refresh()
    })
  }

  const handleDisablePin = () => {
    setVerifyError(null)
    if (isEnabled) {
      if (authMethod === "pin" && !/^\d{4}$/.test(verifySecret)) {
        setVerifyError("Enter your current 4-digit PIN first to turn off PIN lock")
        return
      }
      if (authMethod === "password" && verifySecret.length < 6) {
        setVerifyError("Enter your account password first to turn off PIN lock")
        return
      }
    }
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
        setVerifyError(res.fieldErrors?.currentPin?.[0] ?? res.fieldErrors?.password?.[0] ?? null)
        toast.error(res.error)
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
    <div className={styles.formStack4}>
      <div className={styles.pinStatusBar}>
        <div className={styles.pinStatusLeft}>
          {isEnabled ? (
            <KeyRoundIcon className={styles.iconPrimary16} aria-hidden />
          ) : (
            <ShieldOffIcon className={styles.iconMuted16} aria-hidden />
          )}
          <span className={styles.fontMedium}>
            {isEnabled
              ? "Active — locks screen every 12 hours"
              : status.mode === "disabled"
                ? "Turned off — won't ask for a PIN"
                : "Not set — we'll ask once after 12 hours"}
          </span>
        </div>
        {isEnabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleLockNow}
            className={styles.roundedFullBtn}
          >
            <LockIcon /> Lock screen now
          </Button>
        )}
      </div>

      {!isEnabled ? (
        <form noValidate onSubmit={handleSetPin} className={styles.formStack3}>
          <div className={styles.twoColFormGrid}>
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
          <div className={styles.flexWrapGap2}>
            <Button
              type="submit"
              disabled={pending || (setPinVal ?? "").length !== 4 || (setConfirmVal ?? "").length !== 4}
              className={styles.roundedFullBtn}
            >
              {pending && <Loader2Icon className={styles.spinIcon} />} Enable 4-digit PIN
            </Button>
            {status.mode === "unset" && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={handleDisablePin}
                className={styles.roundedFullBtn}
              >
                Don&apos;t use PIN
              </Button>
            )}
          </div>
        </form>
      ) : (
        <form
          key={`pin-change-${pinResetCount}`}

          noValidate
          onSubmit={(e) => {
            if (showDisableConfirm) {
              e.preventDefault()
              handleDisablePin()
            } else {
              handleChangePin(e)
            }
          }}
          className={styles.formStack3}
        >
          <div className={styles.pinVerifyHeaderRow}>
            <span className={styles.verifyMutedLabel}>
              Verify with your {authMethod === "pin" ? "current PIN" : "account password"} to change or turn off PIN:
            </span>
            <button
              type="button"
              onClick={() => {
                setAuthMethod((m) => (m === "pin" ? "password" : "pin"))
                setVerifySecret("")
                setVerifyError(null)
              }}
              className={styles.textPrimaryLinkBtn}
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
                setVerifyError(null)
              }}
              error={verifyError ?? undefined}
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
                setVerifyError(null)
              }}
              error={verifyError ?? undefined}
            />
          )}

          {!showDisableConfirm ? (
            <>
              <div className={styles.twoColFormGrid}>
                <TextField
                  label="New 4-digit PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={nextPin}
                  onChange={(e) => {
                    setNextPin(e.target.value)
                    setNextPinError(null)
                  }}
                  error={
                    nextPinError ??
                    (authMethod === "pin" && verifySecret.length === 4 && nextPin.length === 4 && verifySecret === nextPin
                      ? "New PIN must be different from current PIN"
                      : undefined)
                  }
                />
                <TextField
                  label="Confirm new PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={confirmNextPin}
                  onChange={(e) => {
                    setConfirmNextPin(e.target.value)
                    setConfirmPinError(null)
                  }}
                  error={
                    confirmPinError ??
                    (nextPin.length === 4 && confirmNextPin.length === 4 && nextPin !== confirmNextPin
                      ? "New PINs don't match"
                      : undefined)
                  }
                />
              </div>
              <div className={styles.flexWrapGap2}>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    pending ||
                    !verifySecret ||
                    nextPin.length !== 4 ||
                    confirmNextPin.length !== 4 ||
                    nextPin !== confirmNextPin ||
                    (authMethod === "pin" && verifySecret === nextPin)
                  }
                  className={styles.roundedFullBtn}
                >
                  {pending && <Loader2Icon className={styles.spinIcon} />} Change PIN
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setShowDisableConfirm(true)
                    setVerifyError(null)
                  }}
                  className={styles.destructiveGhostBtn}
                >
                  Don&apos;t use PIN (Turn off)
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.disableConfirmBox}>
              <p className={styles.disableConfirmText}>
                Turning off Quick PIN means the admin panel will stay unlocked for your full 7-day login session without asking for a 4-digit PIN every 12 hours.{" "}
                {!verifySecret && (
                  <span className={styles.confirmHighlight}>
                    Enter your {authMethod === "pin" ? "current 4-digit PIN" : "account password"} in the field above to confirm.
                  </span>
                )}
              </p>
              <div className={styles.flexWrapGap2}>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending || !verifySecret}
                  onClick={handleDisablePin}
                  className={styles.roundedFullBtn}
                >
                  {pending && <Loader2Icon className={styles.spinIcon} />} Confirm: Don&apos;t use PIN
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setShowDisableConfirm(false)
                    setVerifyError(null)
                  }}
                  className={styles.roundedFullBtn}
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
    <div className={styles.accountSettingsGrid}>
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
