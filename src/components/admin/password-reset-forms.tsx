"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRoundIcon, Loader2Icon, MailCheckIcon, SendIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { notifyAdminPinChanged } from "@/components/admin/admin-account-menu"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { requestPasswordReset, resetAdminPassword } from "@/features/auth/account-actions"
import { emailSchema, resetSchema } from "@/features/auth/account-schema"
import { useToastAfter } from "@/hooks/use-toast-after"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"

/** Step 1: ask for the account email; a reset link is sent. */
export function ForgotPasswordForm() {
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.input<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })

  useEffect(() => {
    const errParam = params.get("error")
    if (errParam === "expired") {
      toast.error("That link has expired or was already used. Request a new one below.")
    }
    if (typeof window !== "undefined" && (errParam || window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [params])

  useEffect(() => {
    return () => {
      form.reset({ email: "" })
      setSentTo(null)
    }
  }, [form])

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
      className="space-y-2"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const res = await requestPasswordReset(values)
          if (res.ok) {
            setSentTo(values.email)
          } else {
            if (res.fieldErrors?.email?.[0]) {
              form.setError("email", { message: res.fieldErrors.email[0] })
            }
            toast.error(res.error)
          }
        })
      )}
    >
      <TextField label="Admin email" kind="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <Button data-ui="admin/ForgotPasswordForm/Button-send-reset-link" type="submit" size="lg" disabled={pending} className="h-11 w-full gap-2 rounded-full">
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon className="size-4" />} Send reset link
      </Button>
    </form>
  )
}

/** Step 2: the link signed the admin in; choose a new password. */
export function ResetPasswordForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(pending)
  const form = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { next: "", confirm: "" } })
  const { errors } = form.formState

  useEffect(() => {
    return () => {
      form.reset({ next: "", confirm: "" })
    }
  }, [form])

  return (
    <form
      data-ui="admin/ResetPasswordForm"
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const res = await resetAdminPassword(values)
          if (!res.ok) {
            for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
              if (msgs?.[0] && (field === "next" || field === "confirm")) {
                form.setError(field, { message: msgs[0] })
              }
            }
            toast.error(res.error)
            if (res.error.toLowerCase().includes("expired")) {
              router.replace("/admin/forgot-password?error=expired")
            }
            return
          }
          form.reset({ next: "", confirm: "" })
          notifyAdminPinChanged({ unlockedAt: res.data.unlockedAt, manualLock: false })
          showSuccess("Password updated")
          later(() => toast.success("Your password has been updated"))
          router.replace("/admin")
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
      <Button data-ui="admin/ResetPasswordForm/Button-set-new-password" type="submit" size="lg" disabled={pending} className="h-11 w-full gap-2 rounded-full">
        {pending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon className="size-4" />} Set new password
      </Button>
    </form>
  )
}
