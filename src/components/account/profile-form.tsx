"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, MailCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { applyClientProfileUpdate } from "@/components/shared/auth-listener"
import { Button } from "@/components/ui/button"
import { updateProfile } from "@/features/account/actions"
import { profileSchema, type Profile, type ProfileInput } from "@/features/account/schema"
import { normalizeIndianPhone } from "@/lib/format"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

export function ProfileForm({ profile }: { profile: Profile }) {
  const [visitKey, setVisitKey] = useState(0)
  const [saved, setSaved] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
  })
  const [prevProfile, setPrevProfile] = useState(profile)

  if (
    profile.fullName !== prevProfile.fullName ||
    profile.email !== prevProfile.email ||
    profile.phone !== prevProfile.phone
  ) {
    setPrevProfile(profile)
    setSaved({ fullName: profile.fullName, email: profile.email, phone: profile.phone })
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

  return <ProfileFormInner key={visitKey} saved={saved} onSaved={setSaved} />
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
