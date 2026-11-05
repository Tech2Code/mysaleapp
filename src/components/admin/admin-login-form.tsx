"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { signInAdmin } from "@/features/auth/actions"
import { safeNextPath } from "@/lib/safe-redirect"
import { LIMITS, v } from "@/lib/validation"

const schema = z.object({
  email: v.email(),
  password: v.password(),
})
type Values = z.infer<typeof schema>

export function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(
    params.get("error") === "not-admin" ? "This account doesn't have admin access." : null
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null)
      const res = await signInAdmin(values)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const next = safeNextPath(params.get("next"), "/admin")
      router.replace(next.startsWith("/admin") ? next : "/admin")
      router.refresh()
    })
  )

  return (
    <form data-ui="admin/AdminLoginForm" onSubmit={onSubmit} noValidate className="space-y-1.5">
      <TextField label="Email" kind="email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <TextField
        label="Password" maxLength={LIMITS.password.max}
        type="password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <p className="-mt-2 text-right text-sm">
        <Link href="/admin/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Sign in
      </Button>
    </form>
  )
}
