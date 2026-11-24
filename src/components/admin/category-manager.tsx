"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteCategory, saveCategory } from "@/features/products/actions"
import { categorySchema, type CategoryInput, type CategoryValues } from "@/features/products/schema"
import type { Category } from "@/features/products/types"
import { slugify } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

type Row = Category & { productCount: number }

function CategoryDialog({
  category,
  nextSort,
  open,
  onOpenChange,
}: {
  category: Row | null
  nextSort: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [slugTouched, setSlugTouched] = useState(Boolean(category))
  const form = useForm<CategoryInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      sort: category?.sort ?? nextSort,
      reviewAspects: (category?.reviewAspects ?? []).join(", "),
    },
  })
  const { errors } = form.formState
  const [nameVal, slugVal, descVal, sortVal, aspectsVal] = useWatch({
    control: form.control,
    name: ["name", "slug", "description", "sort", "reviewAspects"],
  })

  const hasChanges = !category
    ? Boolean((nameVal ?? "").trim() && (slugVal ?? "").trim())
    : (nameVal ?? "").trim() !== category.name.trim() ||
      (slugVal ?? "").trim() !== category.slug.trim() ||
      (descVal ?? "").trim() !== (category.description ?? "").trim() ||
      Number(sortVal) !== Number(category.sort) ||
      String(aspectsVal ?? "").trim() !== (category.reviewAspects ?? []).join(", ")

  const onSubmit = form.handleSubmit((values) => {
    if (category && !hasChanges) return
    startTransition(async () => {
      const res = await saveCategory(category?.id ?? null, values)
      if (!res.ok) {
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0] && (field === "name" || field === "slug" || field === "description" || field === "sort" || field === "reviewAspects")) {
            form.setError(field, { message: msgs[0] })
          }
        }
        toast.error(res.error)
        return
      }
      later(() => {
        onOpenChange(false)
        toast.success(category ? "Category updated" : "Category added")
      })
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent data-ui="admin/CategoryDialog/DialogContent" mobileFullScreen className="sm:max-w-md">
        <form data-ui="admin/CategoryDialog/form-flex" onSubmit={onSubmit} noValidate className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Categories group products in the menu and get their own SEO page.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <TextField
              label="Name" maxLength={LIMITS.categoryName.max}
              fieldSize="md"
              error={errors.name?.message}
              {...form.register("name", {
                onChange: (e) => {
                  if (!category && !slugTouched) form.setValue("slug", slugify(e.target.value))
                },
              })}
            />
            <TextField
              label="URL slug"
              kind="slug"
              fieldSize="md"
              className="font-mono text-sm"
              error={errors.slug?.message}
              {...form.register("slug", {
                onChange: () => setSlugTouched(true),
              })}
            />
            <TextAreaField
              label="Description" maxLength={LIMITS.categoryDescription.max}
              rows={3}
              hint="Shown on the category page and to Google"
              error={errors.description?.message}
              {...form.register("description")}
            />
            <TextField
              label="Sort order" kind="digits" maxLength={3}
              fieldSize="md"
              inputMode="numeric"
              hint="Lower numbers show first"
              containerClassName="w-40"
              error={errors.sort?.message}
              {...form.register("sort")}
            />
            <TextField
              label="Review aspects"
              fieldSize="md"
              maxLength={400}
              placeholder="e.g. Fragrance, Burn Time, Packaging"
              hint="Comma-separated options for “Why do you love it?” (up to 8). Leave blank for defaults."
              error={errors.reviewAspects?.message}
              {...form.register("reviewAspects")}
            />
          </DialogBody>
          <DialogFooter>
            <Button data-ui="admin/CategoryDialog/Button-cancel" type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)} className="gap-1.5 rounded-full">
              <XIcon className="size-4" /> Cancel
            </Button>
            <Button data-ui="admin/CategoryDialog/Button-save" type="submit" disabled={pending || !hasChanges} className="gap-1.5 rounded-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon className="size-4" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryManager({ categories }: { categories: Row[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)
  const nextSort = categories.reduce((m, c) => Math.max(m, c.sort), 0) + 1

  const [toDelete, setToDelete] = useState<Row | null>(null)

  useLayoutEffect(() => {
    return () => {
      setOpen(false)
      setEditing(null)
      setToDelete(null)
    }
  }, [])

  const remove = (c: Row) => {
    setDeletingId(c.id)
    startTransition(async () => {
      const res = await deleteCategory(c.id)
      setDeletingId(null)
      if (res.ok) {
        later(() => {
          setToDelete(null)
          toast.success("Category deleted")
        })
        router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <>
      <div data-ui="admin/CategoryManager/div-flex" className="mb-4 flex justify-end">
        <Button data-ui="admin/CategoryManager/Button-add-category"
          size="sm"
          className="h-9 rounded-lg px-3.5 text-xs font-semibold"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <PlusIcon className="size-3.5" /> Add category
        </Button>
      </div>

      <ul data-ui="admin/CategoryManager/ul" className="adminCard divide-y divide-border/70 overflow-hidden rounded-xl border">
        {categories.length === 0 && <li data-ui="admin/CategoryManager/li" className="p-7 sm:p-10 text-center text-sm text-muted-foreground">No categories yet.</li>}
        {categories.map((c) => (
          <li data-ui="admin/CategoryManager/li-flex" key={c.id} className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/35">
            <span data-ui="admin/CategoryManager/span-grid" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-heading text-base font-semibold text-foreground">
              {c.name.charAt(0)}
            </span>
            <div data-ui="admin/CategoryManager/div" className="min-w-0 flex-1">
              <p data-ui="admin/CategoryManager/p" className="font-medium">{c.name}</p>
              <p data-ui="admin/CategoryManager/p-2" className="truncate text-xs text-muted-foreground">
                /category/{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"} · order {c.sort}
              </p>
            </div>
            <Button data-ui="admin/CategoryManager/Button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${c.name}`}
              onClick={() => {
                setEditing(c)
                setOpen(true)
              }}
            >
              <PencilIcon />
            </Button>
            <Button data-ui="admin/CategoryManager/Button-2"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${c.name}`}
              className="text-destructive hover:bg-destructive/10"
              disabled={deletingId === c.id}
              onClick={() => setToDelete(c)}
            >
              {deletingId === c.id ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && !pending && setToDelete(null)}
        destructive
        title={`Delete “${toDelete?.name ?? ""}”?`}
        description={toDelete?.productCount ? `Its ${toDelete.productCount} product(s) will stay in the store without a category.` : "This can't be undone."}
        confirmLabel="Delete category"
        pending={pending}
        onConfirm={() => toDelete && remove(toDelete)}
      />
      {open && <CategoryDialog key={editing?.id ?? "new"} category={editing} nextSort={nextSort} open={open} onOpenChange={setOpen} />}
    </>
  )
}
