"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/features/account/actions"
import { profileSchema, type Profile, type ProfileInput } from "@/features/account/schema"

export function ProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.fullName,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      pincode: profile.pincode,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateProfile(values)
      if (res.ok) toast.success("Profile saved")
      else toast.error(res.error)
    })
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-3xl border bg-card p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Full name" error={errors.fullName?.message}>
          <Input className="h-11" autoComplete="name" {...form.register("fullName")} />
        </FormField>
        <FormField label="Email" hint="From your Google account">
          <Input className="h-11" value={profile.email} readOnly disabled />
        </FormField>
        <FormField label="Mobile number" error={errors.phone?.message}>
          <Input className="h-11" type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
        </FormField>
        <FormField label="Pincode" error={errors.pincode?.message}>
          <Input className="h-11" inputMode="numeric" maxLength={6} autoComplete="postal-code" {...form.register("pincode")} />
        </FormField>
        <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Textarea rows={3} autoComplete="street-address" {...form.register("address")} />
        </FormField>
        <FormField label="City" error={errors.city?.message}>
          <Input className="h-11" autoComplete="address-level2" {...form.register("city")} />
        </FormField>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-8">
        {pending && <Loader2Icon className="animate-spin" />} Save changes
      </Button>
    </form>
  )
}
