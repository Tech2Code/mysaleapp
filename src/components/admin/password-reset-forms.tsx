"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, MailCheckIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { requestPasswordReset, resetAdminPassword } from "@/features/auth/account-actions"
import { emailSchema, resetSchema } from "@/features/auth/account-schema"
import { LIMITS } from "@/lib/validation"

/** Step 1: ask for the account email; a reset link is sent. */
export function ForgotPasswordForm() {
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    params.get("error") === "expired" ? "That link has expired or was already used. Request a new one below." : null
  )
  const form = useForm<z.input<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })

  if (sentTo) {
    return (
      <div data-ui="admin/ForgotPasswordForm" role="status" className="space-y-3 rounded-2xl bg-success/10 p-4 text-sm">
        <p data-ui="admin/ForgotPasswordForm/p-flex" className="flex items-center gap-2 font-semibold">
          <MailCheckIcon className="size-4 text-success" aria-hidden /> Check your inbox
        </p>
        <p data-ui="admin/ForgotPasswordForm/p">
          If <span data-ui="admin/ForgotPasswordForm/span" className="font-semibold">{sentTo}</span> is an admin account, a reset link is on its way. It works once and expires soon.
        </p>
      </div>
    )
  }

  return (
    <form
      data-ui="admin/ForgotPasswordForm"
      noValidate
      className="space-y-1"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null)
          const res = await requestPasswordReset(values)
          if (res.ok) setSentTo(values.email)
          else setError(res.error)
        })
      )}
    >
      <TextField label="Admin email" kind="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      {error && (
        <p data-ui="admin/ForgotPasswordForm/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button data-ui="admin/ForgotPasswordForm/Button-send-reset-link" type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Send reset link
      </Button>
    </form>
  )
}

/** Step 2: the link signed the admin in; choose a new password. */
export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { next: "", confirm: "" } })
  const { errors } = form.formState

  return (
    <form
      data-ui="admin/ResetPasswordForm"
      noValidate
      className="space-y-1"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null)
          const res = await resetAdminPassword(values) // redirects to /admin on success
          if (res && !res.ok) setError(res.error)
        })
      )}
    >
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
      {error && (
        <p data-ui="admin/ResetPasswordForm/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button data-ui="admin/ResetPasswordForm/Button-set-new-password" type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Set new password
      </Button>
    </form>
  )
}
