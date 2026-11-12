"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, LogInIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { signInAdmin } from "@/features/auth/actions"
import { safeNextPath } from "@/lib/safe-redirect"
import { LIMITS, v } from "@/lib/validation"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"

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
  const [error, setError] = useState<string | null>(
    params.get("error") === "not-admin" ? "This account doesn't have admin access." : null
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  useEffect(() => {
    return () => {
      form.reset({ email: "", password: "" })
      setError(null)
    }
  }, [form])

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null)
      const res = await signInAdmin(values)
      if (!res.ok) {
        setError(res.error)
        return
      }
      showSuccess("Login successful")
      const next = safeNextPath(params.get("next"), "/admin")
      const adminTarget = (next === "/admin" || next.startsWith("/admin/")) && !next.startsWith("/admin/reset-password") ? next : "/admin"
      router.replace(adminTarget)
      router.refresh()
    })
  )

  return (
    <form data-ui="admin/AdminLoginForm" onSubmit={onSubmit} noValidate className="space-y-2">
      <TextField label="Email" kind="email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <TextField
        label="Password" maxLength={LIMITS.password.max}
        type="password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <div data-ui="admin/AdminLoginForm/div-flex" className="flex justify-end pt-0.5 text-sm">
        <Link data-ui="admin/AdminLoginForm/Link-forgot-password" href="/admin/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      {error && (
        <p data-ui="admin/AdminLoginForm/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button data-ui="admin/AdminLoginForm/Button-sign-in" type="submit" size="lg" disabled={pending} className="h-11 w-full gap-2 rounded-full">
        {pending ? <Loader2Icon className="animate-spin" /> : <LogInIcon className="size-4" />} Sign in
      </Button>
    </form>
  )
}
