"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signInAdmin } from "@/features/auth/actions"
import { safeNextPath } from "@/lib/safe-redirect"

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password is too short"),
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
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" className="h-11" {...form.register("email")} />
      </FormField>
      <FormField label="Password" error={form.formState.errors.password?.message}>
        <Input type="password" autoComplete="current-password" className="h-11" {...form.register("password")} />
      </FormField>
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
