"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useLayoutEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { updateProfile } from "@/features/account/actions"
import { profileSchema, type Profile, type ProfileInput } from "@/features/account/schema"
import { normalizeIndianPhone } from "@/lib/format"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

export function ProfileForm({ profile }: { profile: Profile }) {
  const [visitKey, setVisitKey] = useState(0)
  const [saved, setSaved] = useState({ fullName: profile.fullName, phone: profile.phone })
  const [prevProfile, setPrevProfile] = useState(profile)

  if (profile.fullName !== prevProfile.fullName || profile.phone !== prevProfile.phone) {
    setPrevProfile(profile)
    setSaved({ fullName: profile.fullName, phone: profile.phone })
  }

  useLayoutEffect(() => {
    return () => {
      setVisitKey((k) => k + 1)
    }
  }, [])

  return <ProfileFormInner key={visitKey} email={profile.email} saved={saved} onSaved={setSaved} />
}

function ProfileFormInner({
  email,
  saved,
  onSaved,
}: {
  email: string
  saved: { fullName: string; phone: string }
  onSaved: (next: { fullName: string; phone: string }) => void
}) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: saved.fullName, phone: saved.phone },
  })
  const { errors } = form.formState
  const [fullNameVal, phoneVal] = useWatch({ control: form.control, name: ["fullName", "phone"] })

  const hasChanges =
    (fullNameVal ?? "").trim() !== saved.fullName.trim() ||
    (normalizeIndianPhone(phoneVal ?? "") ?? (phoneVal ?? "").trim()) !== (normalizeIndianPhone(saved.phone) ?? saved.phone.trim())

  const onSubmit = form.handleSubmit((values) => {
    if (!hasChanges) return
    startTransition(async () => {
      const res = await updateProfile(values)
      if (res.ok) {
        const rawPhone = values.phone ?? ""
        const nextSaved = { fullName: values.fullName.trim(), phone: normalizeIndianPhone(rawPhone) ?? rawPhone.trim() }
        onSaved(nextSaved)
        later(() => toast.success("Profile saved"))
        form.reset(nextSaved)
      } else toast.error(res.error)
    })
  })

  return (
    <form data-ui="account/ProfileForm" onSubmit={onSubmit} noValidate className="space-y-1 rounded-3xl border bg-card p-6 sm:p-8">
      <div data-ui="account/ProfileForm/div-grid" className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Full name" kind="personName" autoComplete="name" error={errors.fullName?.message} {...form.register("fullName")} />
        <TextField label="Email" kind="email" hint="From your Google account" value={email} readOnly disabled />
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
      <Button data-ui="account/ProfileForm/Button-save-changes" type="submit" size="lg" disabled={pending || !hasChanges} className="h-11 rounded-full px-5 sm:px-8">
        {pending && <Loader2Icon className="animate-spin" />} Save changes
      </Button>
    </form>
  )
}
