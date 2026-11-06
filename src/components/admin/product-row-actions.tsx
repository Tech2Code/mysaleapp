"use client"

import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { deleteProduct, toggleProductFlag } from "@/features/products/actions"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ui="admin/ProductRowActions/DialogContent">
          <DialogHeader>
            <DialogTitle>Delete “{name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the product and its photos. Past orders keep their copy of the item.
              To just hide it from the store, switch off “Active” instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button data-ui="admin/ProductRowActions/Button-2" variant="outline" />}>Cancel</DialogClose>
            <Button data-ui="admin/ProductRowActions/Button-delete"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteProduct(productId)
                  if (res.ok) {
                    toast.success("Product deleted")
                    setOpen(false)
                    router.refresh()
                  } else toast.error(res.error)
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
