"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, LogInIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useLayoutEffect, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextField } from "@/components/form"
import { applyClientSignIn } from "@/components/shared/auth-listener"
import { Button } from "@/components/ui/button"
import { signInAdmin } from "@/features/auth/actions"
import { safeNextPath } from "@/lib/safe-redirect"
import { LIMITS, v } from "@/lib/validation"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import styles from "./admin-core.module.css"

const schema = z.object({
  email: v.email(),
  password: v.password(),
})
type Values = z.infer<typeof schema>

export function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  useEffect(() => {
    const reason = params.get("reason")
    const errParam = params.get("error")
    if (reason === "session-expired") {
      toast.info("Your 7-day admin session has expired. Please sign in again.")
    } else if (errParam === "not-admin") {
      toast.error("That account does not have admin access.")
    }
    if (typeof window !== "undefined" && (reason || errParam || window.location.hash)) {
      const nextParam = params.get("next")
      const clean = nextParam ? `/admin/login?next=${encodeURIComponent(nextParam)}` : "/admin/login"
      window.history.replaceState(null, "", clean)
    }
  }, [params])

  useLayoutEffect(() => {
    return () => {
      form.reset({ email: "", password: "" })
    }
  }, [form])

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await signInAdmin(values)
      if (!res.ok) {
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0] && (field === "email" || field === "password")) {
            form.setError(field, { message: msgs[0] })
          }
        }
        toast.error(res.error)
        return
      }
      form.reset({ email: "", password: "" })
      applyClientSignIn(res.data.user)
      showSuccess("Login successful")
      const next = safeNextPath(params.get("next"), "/admin")
      const adminTarget = (next === "/admin" || next.startsWith("/admin/")) && !next.startsWith("/admin/reset-password") ? next : "/admin"
      router.replace(adminTarget)
    })
  )

  return (
    <form onSubmit={onSubmit} noValidate className={styles.authFormStack}>
      <TextField label="Email" kind="email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <TextField
        label="Password" maxLength={LIMITS.password.max}
        type="password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <div className={styles.forgotLinkRow}>
        <Link href="/admin/forgot-password" className={styles.primaryHoverLink}>
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending} className={styles.authSubmitBtn}>
        {pending ? <Loader2Icon className={styles.spinIcon} /> : <LogInIcon className={styles.icon16} />} Sign in
      </Button>
    </form>
  )
}
