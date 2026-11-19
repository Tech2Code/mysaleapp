"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRoundIcon, Loader2Icon, MailCheckIcon, ShieldAlertIcon, UserXIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { applyClientProfileUpdate, applyClientSignOut } from "@/components/shared/auth-listener"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { changeCustomerPassword, deactivateMyAccount, updateProfile } from "@/features/account/actions"
import {
  customerPasswordSchema,
  DEACTIVATION_REASONS,
  profileSchema,
  type CustomerPasswordInput,
  type Profile,
  type ProfileInput,
} from "@/features/account/schema"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"

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
    <div data-ui="account/ProfileForm" className="space-y-6">
      <ProfileFormInner key={`details-${visitKey}`} saved={saved} onSaved={setSaved} />
      <CustomerPasswordForm
        key={`password-${visitKey}-${hasPassword ? "change" : "set"}`}
        hasPassword={hasPassword}
        onPasswordSet={() => setHasPassword(true)}
      />
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
    <form data-ui="account/ProfileFormInner" onSubmit={onSubmit} noValidate className="space-y-3 rounded-3xl border bg-card p-6 sm:p-8">
      <div data-ui="account/ProfileFormInner/div-grid" className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
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
          data-ui="account/ProfileFormInner/p"
          role="status"
          className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
            callbackBanner.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10"
          }`}
        >
          <MailCheckIcon className={`mt-0.5 size-4 shrink-0 ${callbackBanner.tone === "error" ? "text-destructive" : "text-success"}`} aria-hidden />
          <span data-ui="account/ProfileFormInner/span">{callbackBanner.text}</span>
        </p>
      )}
      {sentTo && (
        <p data-ui="account/ProfileFormInner/p-flex" role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span data-ui="account/ProfileFormInner/span-2">
            We sent a confirmation link to <span data-ui="account/ProfileFormInner/span-3" className="font-semibold">{sentTo}</span> (and to{" "}
            <span data-ui="account/ProfileFormInner/span-4" className="font-semibold">{saved.email}</span> if double confirmation is enabled). Open the link(s) to finish changing your login email.
          </span>
        </p>
      )}
      <Button data-ui="account/ProfileFormInner/Button-save-changes" type="submit" size="lg" disabled={pending || !hasChanges} className="h-11 rounded-full px-5 sm:px-8">
        {pending && <Loader2Icon className="animate-spin" />} Save changes
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
    ? Boolean(currentVal && nextVal && confirmVal && currentVal !== nextVal)
    : Boolean(nextVal && confirmVal)

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
      data-ui="account/CustomerPasswordForm"
      onSubmit={onSubmit}
      noValidate
      className="space-y-3 rounded-3xl border bg-card p-6 sm:p-8"
    >
      <div data-ui="account/CustomerPasswordForm/div">
        <h3 data-ui="account/CustomerPasswordForm/h3-flex" className="flex items-center gap-2 font-sans text-lg font-semibold">
          <KeyRoundIcon className="size-4 text-primary" aria-hidden />
          {hasPassword ? "Change password" : "Set a password"}
        </h3>
        <p data-ui="account/CustomerPasswordForm/p" className="mt-0.5 text-sm text-muted-foreground">
          {hasPassword
            ? "Update the password you use to sign in with your email address."
            : "Set a password so you can also sign in directly with your email and password."}
        </p>
      </div>

      <div
        data-ui="account/CustomerPasswordForm/div-2"
        className={`grid gap-x-5 gap-y-1 ${hasPassword ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}
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
          error={errors.next?.message}
          {...form.register("next")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          error={errors.confirm?.message}
          {...form.register("confirm")}
        />
      </div>

      <Button
        data-ui="account/CustomerPasswordForm/Button"
        type="submit"
        variant="outline"
        size="lg"
        disabled={pending || !canSubmit}
        className="h-11 rounded-full px-5 sm:px-8"
      >
        {pending && <Loader2Icon className="animate-spin" />}
        {hasPassword ? "Update password" : "Save password"}
      </Button>
    </form>
  )
}

function DeactivateAccountCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reasonChoice, setReasonChoice] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReasonChoice("")
      setCustomNote("")
      setError(null)
    }
  }

  const handleDeactivate = () => {
    setError(null)
    const combinedReason = [reasonChoice, customNote.trim()].filter(Boolean).join(" — ").slice(0, 200)
    startTransition(async () => {
      const res = await deactivateMyAccount({ reason: combinedReason || undefined })
      if (!res.ok) {
        setError(res.error)
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
      data-ui="account/DeactivateAccountCard"
      aria-label="Deactivate account"
      className="flex flex-col justify-between gap-4 rounded-3xl border border-destructive/25 bg-card p-6 sm:flex-row sm:items-center sm:p-8"
    >
      <div data-ui="account/DeactivateAccountCard/div" className="space-y-1">
        <h3 data-ui="account/DeactivateAccountCard/h3-deactivate-account" className="flex items-center gap-2 font-sans text-lg font-semibold text-foreground">
          <UserXIcon className="size-4 text-destructive" aria-hidden />
          Deactivate account
        </h3>
        <p data-ui="account/DeactivateAccountCard/p" className="max-w-xl text-sm/relaxed text-muted-foreground">
          Taking a break? You can deactivate your account once all active orders and returns are complete. If you change your mind or deactivate by mistake, simply sign back in anytime to automatically restore your account and order history.
        </p>
      </div>

      <Button
        data-ui="account/DeactivateAccountCard/Button-deactivate-account"
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        className="h-11 shrink-0 rounded-full border-destructive/40 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <UserXIcon className="size-4" /> Deactivate account
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent data-ui="account/DeactivateAccountCard/DialogContent" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate your account?</DialogTitle>
            <DialogDescription>
              You will be signed out immediately. Your past order records and tax invoices are safely retained per e-commerce and tax regulations.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div data-ui="account/DeactivateAccountCard/div-2" className="rounded-xl border border-primary/20 bg-primary/8 p-3 text-xs/relaxed text-foreground">
              <p data-ui="account/DeactivateAccountCard/p-flex" className="flex items-center gap-1.5 font-semibold text-primary">
                <ShieldAlertIcon className="size-3.5 shrink-0" aria-hidden /> Easy recovery if deactivated by mistake
              </p>
              <p data-ui="account/DeactivateAccountCard/p-2" className="mt-1 text-muted-foreground">
                Signing back in with your email/password or Google account at any time will automatically reactivate your profile, saved addresses, and order history.
              </p>
            </div>

            <SelectField
              label="Why are you deactivating? (optional)"
              placeholder="Select a reason"
              fieldSize="md"
              value={reasonChoice}
              onValueChange={setReasonChoice}
              options={DEACTIVATION_REASONS.map((r) => ({ value: r, label: r }))}
            />

            {reasonChoice === "Other" && (
              <TextAreaField
                label="Additional feedback (optional)"
                rows={2}
                maxLength={140}
                placeholder="Tell us how we can improve"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
              />
            )}

            {error && (
              <p data-ui="account/DeactivateAccountCard/p-3" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              data-ui="account/DeactivateAccountCard/Button-keep-account-active"
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
              className="gap-1.5 rounded-full"
            >
              <XIcon className="size-4" /> Keep account active
            </Button>
            <Button
              data-ui="account/DeactivateAccountCard/Button-deactivate-account-2"
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDeactivate}
              className="gap-1.5 rounded-full"
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <UserXIcon className="size-4" />} Deactivate account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
