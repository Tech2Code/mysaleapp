"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, SearchIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trackOrder } from "@/features/orders/actions"
import { trackOrderSchema } from "@/features/orders/schema"
import { STATUS_META, type TrackedOrder } from "@/features/orders/types"
import { formatDate, formatPrice } from "@/lib/format"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { StatusBadge } from "@/components/shared/status-badge"

type TrackInput = z.input<typeof trackOrderSchema>

export function TrackOrder() {
  const params = useSearchParams()
  const [result, setResult] = useState<TrackedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<TrackInput>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { code: params.get("code") ?? "", phoneLast4: "" },
  })

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const res = await trackOrder(values)
      if (res.ok) setResult(res.data)
      else {
        setResult(null)
        setError(res.error)
      }
    })
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl border bg-card p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Order code" error={form.formState.errors.code?.message}>
            <Input
              className="h-11 font-mono uppercase"
              placeholder="KK-7F3K9Q"
              autoCapitalize="characters"
              {...form.register("code")}
            />
          </FormField>
          <FormField label="Last 4 digits of phone" error={form.formState.errors.phoneLast4?.message}>
            <Input className="h-11" inputMode="numeric" maxLength={4} placeholder="3210" {...form.register("phoneLast4")} />
          </FormField>
        </div>
        <Button type="submit" size="lg" disabled={pending} className="h-12 w-full rounded-full text-base">
          {pending ? <Loader2Icon className="animate-spin" /> : <SearchIcon />} Track order
        </Button>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.section
            key={result.orderCode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6 rounded-3xl border bg-card p-6 sm:p-8"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-semibold">{result.orderCode}</p>
                <p className="text-sm text-muted-foreground">
                  Placed {formatDate(result.createdAt)} · {result.city}
                </p>
              </div>
              <StatusBadge status={result.status} />
            </div>
            <p className="text-sm text-muted-foreground">{STATUS_META[result.status].description}.</p>
            <OrderTimeline status={result.status} history={result.history} />
            <ul className="space-y-2 border-t pt-4 text-sm">
              {result.items.map((i) => (
                <li key={i.productId} className="flex justify-between gap-4">
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(i.price * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatPrice(result.subtotal)}</span>
              </li>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
