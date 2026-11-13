"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, MailCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useState, useTransition, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { changeAdminPassword, requestAdminEmailChange, updateAdminProfile } from "@/features/auth/account-actions"
import { changePasswordSchema, emailSchema, profileSchema } from "@/features/auth/account-schema"
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
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.input<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })
  const { errors } = form.formState
  const emailVal = useWatch({ control: form.control, name: "email" })
  const { pending, run } = useSubmit<{ email: string }>((n, m) => form.setError(n, { message: m }))
  const cleanEmail = (emailVal ?? "").trim().toLowerCase()
  const emailUnchanged = !cleanEmail || cleanEmail === email.trim().toLowerCase()

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
            setSentTo(values.email)
            form.reset()
          }
        )
      })}
    >
      <p data-ui="admin/EmailForm/p" className="text-sm wrap-anywhere">
        Signed in as <span data-ui="admin/EmailForm/span" className="font-semibold">{email}</span>
      </p>
      <TextField label="New email address" kind="email" fieldSize="md" error={errors.email?.message} {...form.register("email")} />
      {sentTo && (
        <p data-ui="admin/EmailForm/p-flex" role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span data-ui="admin/EmailForm/span-2">
            We sent a confirmation link to <span data-ui="admin/EmailForm/span-3" className="font-semibold">{sentTo}</span>. Open it to finish. Until then you keep signing in with{" "}
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
      data-ui="admin/PasswordForm"
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit((values) =>
        run(
          () => changeAdminPassword(values),
          () => {
            later(() => toast.success("Password changed"))
            form.reset()
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

/** Everything about the signed-in admin: details, login email and password. */
export function AccountSettings({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [visitKey, setVisitKey] = useState(0)
  const [savedProfile, setSavedProfile] = useState({ name, phone })
  const [prevProps, setPrevProps] = useState({ name, phone })

  if (name !== prevProps.name || phone !== prevProps.phone) {
    setPrevProps({ name, phone })
    setSavedProfile({ name, phone })
  }

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
      <Card title="Login email" description="We email a confirmation link to the new address before it takes effect.">
        <EmailForm key={`email-${visitKey}`} email={email} />
      </Card>
      <Card title="Password" description="Forgot it instead? Use “Forgot password” on the sign-in page.">
        <PasswordForm key={`password-${visitKey}`} />
      </Card>
    </div>
  )
}
