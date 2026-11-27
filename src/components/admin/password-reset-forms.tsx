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
import styles from "./admin-core.module.css"

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
      <div role="status" className={styles.forgotSentBox}>
        <p className={styles.sentHeadingRow}>
          <MailCheckIcon className={styles.iconSuccess16} aria-hidden /> Check your inbox
        </p>
        <p className={styles.sentBodyText}>
          If <span className={styles.fontSemibold}>{sentTo}</span> is an admin account, a reset link is on its way. It works once and expires soon.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <form

      noValidate
      className={styles.authFormStack}
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
      <Button type="submit" size="lg" disabled={pending} className={styles.authSubmitBtn}>
        {pending ? <Loader2Icon className={styles.spinIcon} /> : <SendIcon className={styles.icon16} />} Send reset link
      </Button>
    </form>
  )
}

/** Step 2: the reset link was verified; choose a new password. */
export function ResetPasswordForm({ resetToken = null }: { resetToken?: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(pending)
  const form = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { next: "", confirm: "" } })
  const { errors } = form.formState

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("token=")) {
      window.history.replaceState(null, "", window.location.pathname)
    }
    return () => {
      form.reset({ next: "", confirm: "" })
    }
  }, [form])

  return (
    <form

      noValidate
      className={styles.authFormStack}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const res = await resetAdminPassword({
            ...values,
            ...(resetToken ? { token: resetToken } : {}),
          })
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
      <Button type="submit" size="lg" disabled={pending} className={styles.authSubmitBtn}>
        {pending ? <Loader2Icon className={styles.spinIcon} /> : <KeyRoundIcon className={styles.icon16} />} Set new password
      </Button>
    </form>
  )
}
