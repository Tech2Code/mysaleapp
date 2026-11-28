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
import styles from "./admin-views.module.css"

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
  const later = useToastAfter(pending)

  return (
    <Switch
      checked={optimistic}
      disabled={pending}
      aria-label={label}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked)
          const res = await toggleProductFlag(productId, flag, checked)
          if (!res.ok) {
            toast.error(res.error)
          } else {
            later(() =>
              toast.success(
                flag === "isActive"
                  ? checked
                    ? "Product shown in store"
                    : "Product hidden from store"
                  : checked
                    ? "Featured on home page"
                    : "Removed from featured"
              )
            )
          }
          router.refresh()
        })
      }
    />
  )
}

export function ProductRowActions({ productId, productSlug, name }: { productId: string; productSlug?: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  return (
    <div className={styles.rowActions}>
      <Link
        href={`/admin/products/${encodeURIComponent(productSlug ?? productId)}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label={`Edit ${name}`}
      >
        <PencilIcon aria-hidden="true" />
      </Link>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Delete ${name}`} className={styles.deleteBtn}>
        <Trash2Icon aria-hidden="true" />
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
