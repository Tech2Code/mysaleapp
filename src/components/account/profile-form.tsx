"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { DownloadIcon, KeyRoundIcon, Loader2Icon, MailCheckIcon, ShieldAlertIcon, ShieldCheckIcon, UserXIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { applyClientProfileUpdate, applyClientSignOut } from "@/components/shared/auth-listener"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { changeCustomerPassword, deactivateMyAccount, exportMyAccountData, updateProfile } from "@/features/account/actions"
import {
  customerPasswordSchema,
  DEACTIVATION_REASONS,
  profileSchema,
  type CustomerPasswordInput,
  type Profile,
  type ProfileInput,
} from "@/features/account/schema"
import { cancelReasonText, OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import styles from "./account.module.css"

export function ProfileForm({ profile }: { profile: Profile }) {
  const [visitKey, setVisitKey] = useState(0)
  const [hasPassword, setHasPassword] = useState(profile.hasPassword ?? true)
  const [saved, setSaved] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
  })
  const [prevProfile, setPrevProfile] = useState(profile)

  if (
    profile.fullName !== prevProfile.fullName ||
    profile.email !== prevProfile.email ||
    profile.phone !== prevProfile.phone ||
    profile.hasPassword !== prevProfile.hasPassword
  ) {
    setPrevProfile(profile)
    setSaved({ fullName: profile.fullName, email: profile.email, phone: profile.phone })
    if (profile.hasPassword !== undefined) setHasPassword(profile.hasPassword)
  }

  useEffect(() => {
    applyClientProfileUpdate({
      name: profile.fullName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    })
  }, [profile.fullName, profile.email, profile.avatarUrl])

  useLayoutEffect(() => {
    return () => {
      setVisitKey((k) => k + 1)
    }
  }, [])

  return (
    <div className={styles.profileFormsStack}>
      <ProfileFormInner key={`details-${visitKey}`} saved={saved} onSaved={setSaved} />
      <CustomerPasswordForm
        key={`password-${visitKey}-${hasPassword ? "change" : "set"}`}
        hasPassword={hasPassword}
        onPasswordSet={() => setHasPassword(true)}
      />
      <DataPrivacyCard />
      <DeactivateAccountCard key={`deactivate-${visitKey}`} />
    </div>
  )
}

function ProfileFormInner({
  saved,
  onSaved,
}: {
  saved: { fullName: string; email: string; phone: string }
  onSaved: (next: { fullName: string; email: string; phone: string }) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [callbackBanner, setCallbackBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: saved.fullName, email: saved.email, phone: saved.phone },
  })
  useEffect(() => {
    form.reset({ fullName: saved.fullName, email: saved.email, phone: saved.phone })
  }, [form, saved.email, saved.fullName, saved.phone])
  const { errors } = form.formState
  const [fullNameVal, emailVal, phoneVal] = useWatch({
    control: form.control,
    name: ["fullName", "email", "phone"],
  })

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

  const hasChanges =
    (fullNameVal ?? "").trim() !== saved.fullName.trim() ||
    (emailVal ?? "").trim().toLowerCase() !== saved.email.trim().toLowerCase() ||
    (normalizeIndianPhone(phoneVal ?? "") ?? (phoneVal ?? "").trim()) !==
      (normalizeIndianPhone(saved.phone) ?? saved.phone.trim())

  const onSubmit = form.handleSubmit((values) => {
    if (!hasChanges) return
    startTransition(async () => {
      const res = await updateProfile(values)
      if (res.ok) {
        const rawPhone = values.phone ?? ""
        const nextSaved = {
          fullName: values.fullName.trim(),
          email: res.data.email || saved.email,
          phone: normalizeIndianPhone(rawPhone) ?? rawPhone.trim(),
        }
        onSaved(nextSaved)
        applyClientProfileUpdate({
          name: nextSaved.fullName,
          email: nextSaved.email,
        })
        setCallbackBanner(null)
        if (res.data.emailConfirmationSentTo) {
          setSentTo(res.data.emailConfirmationSentTo)
          later(() => toast.success("Profile saved — check your new email inbox to confirm the email change"))
        } else {
          setSentTo(null)
          later(() => toast.success("Profile saved"))
        }
        form.reset(nextSaved)
      } else {
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) form.setError(field as keyof ProfileInput, { message: msgs[0] })
        }
        toast.error(res.error)
      }
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className={styles.profileCardForm}>
      <div className={styles.threeColFieldsGrid}>
        <TextField label="Full name" kind="personName" autoComplete="name" error={errors.fullName?.message} {...form.register("fullName")} />
        <TextField
          label="Email"
          kind="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="Your login email"
          error={errors.email?.message}
          {...form.register("email")}
        />
        <TextField
          label="Mobile number" kind="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          leading="+91"
          error={errors.phone?.message}
          {...form.register("phone")}
        />
      </div>
      {callbackBanner && (
        <p

          role="status"
          className={cn(
            styles.statusAlertRow,
            callbackBanner.tone === "error" ? styles.statusAlertError : styles.statusAlertSuccess
          )}
        >
          <MailCheckIcon className={callbackBanner.tone === "error" ? styles.alertIconError : styles.alertIconSuccess} aria-hidden />
          <span>{callbackBanner.text}</span>
        </p>
      )}
      {sentTo && (
        <p role="status" className={cn(styles.statusAlertRow, styles.statusAlertSuccess)}>
          <MailCheckIcon className={styles.alertIconSuccess} aria-hidden />
          <span>
            We sent a confirmation link to <span className={styles.boldInline}>{sentTo}</span> (and to{" "}
            <span className={styles.boldInline}>{saved.email}</span> if double confirmation is enabled). Open the link(s) to finish changing your login email.
          </span>
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || !hasChanges} className={styles.savePillBtn}>
        {pending && <Loader2Icon className={styles.spinSvg} />} Save changes
      </Button>
    </form>
  )
}

function CustomerPasswordForm({
  hasPassword,
  onPasswordSet,
}: {
  hasPassword: boolean
  onPasswordSet: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [resetCount, setResetCount] = useState(0)
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const form = useForm<CustomerPasswordInput>({
    resolver: zodResolver(customerPasswordSchema),
    defaultValues: {
      hasPassword,
      current: "",
      next: "",
      confirm: "",
    },
  })
  const { errors } = form.formState
  const [currentVal, nextVal, confirmVal] = useWatch({
    control: form.control,
    name: ["current", "next", "confirm"],
  })

  const canSubmit = hasPassword
    ? Boolean(currentVal && nextVal && confirmVal)
    : Boolean(nextVal && confirmVal)
  const sameAsCurrentError =
    hasPassword && Boolean(currentVal && nextVal && currentVal === nextVal)
      ? "New password must be different from current password"
      : undefined
  const mismatchConfirmError =
    Boolean(nextVal && confirmVal && nextVal !== confirmVal)
      ? "Passwords do not match"
      : undefined

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await changeCustomerPassword(values)
      if (!res.ok) {
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0] && (field === "current" || field === "next" || field === "confirm")) {
            form.setError(field, { message: msgs[0] })
          }
        }
        toast.error(res.error)
        return
      }
      later(() => toast.success(hasPassword ? "Password updated" : "Password set"))
      form.reset({ hasPassword: true, current: "", next: "", confirm: "" })
      setResetCount((c) => c + 1)
      onPasswordSet()
      router.refresh()
    })
  })

  return (
    <form
      key={resetCount}

      onSubmit={onSubmit}
      noValidate
      className={styles.profileCardForm}
    >
      <div>
        <h3 className={styles.formCardHeading}>
          <KeyRoundIcon className={styles.primaryIcon16} aria-hidden />
          {hasPassword ? "Change password" : "Set a password"}
        </h3>
        <p className={styles.formCardSubtext}>
          {hasPassword
            ? "Update the password you use to sign in with your email address."
            : "Set a password so you can also sign in directly with your email and password."}
        </p>
      </div>

      <div

        className={hasPassword ? styles.threeColFieldsGrid : styles.twoColPasswordGrid}
      >
        {hasPassword && (
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            maxLength={LIMITS.password.max}
            error={errors.current?.message}
            {...form.register("current")}
          />
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          hint={`At least ${LIMITS.newPassword.min} characters, with a letter and a number.`}
          error={errors.next?.message ?? sameAsCurrentError}
          {...form.register("next")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          error={errors.confirm?.message ?? mismatchConfirmError}
          {...form.register("confirm")}
        />
      </div>

      <Button

        type="submit"
        variant="outline"
        size="lg"
        disabled={pending || !canSubmit}
        className={styles.savePillBtn}
      >
        {pending && <Loader2Icon className={styles.spinSvg} />}
        {hasPassword ? "Update password" : "Save password"}
      </Button>
    </form>
  )
}

function DataPrivacyCard() {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  const handleDownload = () => {
    startTransition(async () => {
      try {
        const res = await exportMyAccountData()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const blob = new Blob([res.data.htmlReport], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = res.data.fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success("Your readable account data summary has been downloaded.")
      } catch {
        toast.error("Couldn't download your data right now. Please try again.")
      }
    })
  }

  return (
    <section

      aria-label="Your data and privacy"
      className={styles.dataPrivacySection}
    >
      <div className={styles.privacyTextCol}>
        <h3 className={styles.formCardHeading}>
          <ShieldCheckIcon className={styles.primaryIcon16} aria-hidden />
          Your data &amp; privacy
        </h3>
        <p className={styles.privacyCopy}>
          Download an easy-to-read, printable summary of your profile details, saved addresses, wishlist items, order history, and product reviews at any time.
        </p>
      </div>

      <Button

        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleDownload}
        className={styles.downloadDataBtn}
      >
        {pending ? <Loader2Icon className={styles.spinSvg} /> : <DownloadIcon className={styles.icon16} />}
        {pending ? "Preparing export…" : "Download my data"}
      </Button>
    </section>
  )
}

function DeactivateAccountCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reasonChoice, setReasonChoice] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [noteTouched, setNoteTouched] = useState(false)
  const customNoteWrapRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  useEffect(() => {
    return () => {
      setOpen(false)
      setReasonChoice("")
      setCustomNote("")
      setSubmitted(false)
      setNoteTouched(false)
    }
  }, [])

  const needsOtherDetail = otherNeedsDetail(reasonChoice, customNote)
  const canDeactivate = Boolean(reasonChoice) && !needsOtherDetail

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReasonChoice("")
      setCustomNote("")
      setSubmitted(false)
      setNoteTouched(false)
    }
  }

  const handleDeactivate = () => {
    setSubmitted(true)
    if (!canDeactivate) return
    const combinedReason = cancelReasonText(reasonChoice, customNote.trim() || undefined).slice(0, 200)
    startTransition(async () => {
      const res = await deactivateMyAccount({ reason: combinedReason })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      applyClientSignOut()
      await getBrowserSupabase()?.auth.signOut({ scope: "local" })
      later(() => toast.success("Account deactivated. Sign back in anytime to restore your account."))
      router.replace("/login")
    })
  }

  return (
    <section

      aria-label="Deactivate account"
      className={styles.deactivateSection}
    >
      <div className={styles.deactivateTextCol}>
        <h3 className={styles.formCardHeading}>
          <UserXIcon className={styles.destructiveIcon16} aria-hidden />
          Deactivate account
        </h3>
        <p className={styles.deactivateCopy}>
          Taking a break? You can deactivate your account once all active orders and returns are complete. If you change your mind or deactivate by mistake, simply sign back in anytime to automatically restore your account and order history.
        </p>
      </div>

      <Button

        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        className={styles.deactivateTriggerBtn}
      >
        <UserXIcon className={styles.icon16} /> Deactivate account
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={styles.dialogModalMd}>
          <DialogHeader>
            <DialogTitle>Deactivate your account?</DialogTitle>
            <DialogDescription>
              You will be signed out immediately. Your past order records and tax invoices are safely retained per e-commerce and tax regulations.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={styles.deactivateBodyStack}>
            <div className={styles.recoveryInfoBox}>
              <p className={styles.recoveryTitle}>
                <ShieldAlertIcon className={styles.shieldSvg} aria-hidden /> Easy recovery if deactivated by mistake
              </p>
              <p className={styles.recoveryText}>
                Signing back in with your email/password or Google account at any time will automatically reactivate your profile, saved addresses, and order history.
              </p>
            </div>

            <SelectField
              label="Why are you deactivating? *"
              placeholder="Select a reason"
              fieldSize="md"
              value={reasonChoice}
              onValueChange={(val) => {
                setReasonChoice(val)
                if (val === OTHER_REASON) {
                  requestAnimationFrame(() => {
                    customNoteWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                  })
                }
              }}
              options={DEACTIVATION_REASONS.map((r) => ({ value: r, label: r }))}
              error={submitted && !reasonChoice ? "Please select why you are deactivating" : undefined}
            />

            {reasonChoice === OTHER_REASON && (
              <div ref={customNoteWrapRef}>
                <TextAreaField
                  label="Please tell us the reason"
                  required
                  rows={2}
                  maxLength={140}
                  placeholder="Tell us how we can improve (at least 5 letters)"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  onBlur={() => setNoteTouched(true)}
                  error={
                    (submitted || noteTouched) && needsOtherDetail
                      ? OTHER_DETAIL_MESSAGE
                      : undefined
                  }
                />
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button

              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
              className={styles.pillBtnGap}
            >
              <XIcon className={styles.icon16} /> Keep account active
            </Button>
            <Button

              type="button"
              variant="destructive"
              disabled={pending || !canDeactivate}
              onClick={handleDeactivate}
              className={styles.pillBtnGap}
            >
              {pending ? <Loader2Icon className={styles.spinSvg} /> : <UserXIcon className={styles.icon16} />} Deactivate account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
