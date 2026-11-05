"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
  const form = useForm<CategoryInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    values: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      sort: category?.sort ?? nextSort,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveCategory(category?.id ?? null, values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(category ? "Category updated" : "Category added")
      onOpenChange(false)
      router.refresh()
    })
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="space-y-1.5">
          <DialogHeader>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Categories group products in the menu and get their own SEO page.</DialogDescription>
          </DialogHeader>
          <TextField
            label="Name" maxLength={LIMITS.categoryName.max}
            fieldSize="md"
            error={errors.name?.message}
            {...form.register("name", {
              onChange: (e) => {
                if (!category) form.setValue("slug", slugify(e.target.value))
              },
            })}
          />
          <TextField label="URL slug" kind="slug" fieldSize="md" className="font-mono text-sm" error={errors.slug?.message} {...form.register("slug")} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Save
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
  const [, startTransition] = useTransition()
  const nextSort = categories.reduce((m, c) => Math.max(m, c.sort), 0) + 1

  const remove = (c: Row) => {
    const msg = c.productCount
      ? `Delete “${c.name}”? Its ${c.productCount} product(s) will stay in the store without a category.`
      : `Delete “${c.name}”?`
    if (!window.confirm(msg)) return
    setDeletingId(c.id)
    startTransition(async () => {
      const res = await deleteCategory(c.id)
      setDeletingId(null)
      if (res.ok) {
        toast.success("Category deleted")
        router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          className="rounded-full px-4"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <PlusIcon /> Add category
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {categories.length === 0 && <li className="p-7 sm:p-10 text-center text-sm text-muted-foreground">No categories yet.</li>}
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-4 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-heading text-lg font-semibold text-primary">
              {c.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                /category/{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"} · order {c.sort}
              </p>
            </div>
            <Button
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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${c.name}`}
              className="text-destructive hover:bg-destructive/10"
              disabled={deletingId === c.id}
              onClick={() => remove(c)}
            >
              {deletingId === c.id ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            </Button>
          </li>
        ))}
      </ul>

      <CategoryDialog category={editing} nextSort={nextSort} open={open} onOpenChange={setOpen} />
    </>
  )
}
