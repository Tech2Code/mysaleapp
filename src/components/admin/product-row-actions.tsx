"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Switch } from "@/components/ui/switch"
import { deleteProduct, toggleProductFlag } from "@/features/products/actions"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

export function ProductFlagSwitch({
  productId,
  flag,
  value,
  label,
}: {
  productId: string
  flag: "isActive" | "isFeatured"
  value: boolean
  label: string
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useOptimistic(value)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  return (
    <Switch
      checked={optimistic}
      aria-label={label}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked)
          const res = await toggleProductFlag(productId, flag, checked)
          if (!res.ok) toast.error(res.error)
          router.refresh()
        })
      }
    />
  )
}

export function ProductRowActions({ productId, name }: { productId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  return (
    <div data-ui="admin/ProductRowActions" className="flex justify-end gap-1">
      <Link data-ui="admin/ProductRowActions/Link"
        href={`/admin/products/${productId}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label={`Edit ${name}`}
      >
        <PencilIcon />
      </Link>
      <Button data-ui="admin/ProductRowActions/Button" variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Delete ${name}`} className="text-destructive hover:bg-destructive/10">
        <Trash2Icon />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title={`Delete “${name}”?`}
        description="This permanently removes the product and its photos. Past orders keep their copy of the item. To just hide it from the store, switch off “Active” instead."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteProduct(productId)
            if (res.ok) {
              later(() => {
                setOpen(false)
                toast.success("Product deleted")
              })
              router.refresh()
            } else toast.error(res.error)
          })
        }
      />
    </div>
  )
}
