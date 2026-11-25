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
import styles from "./admin-views.module.css"

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
      <DialogContent mobileFullScreen className={styles.dialogSmMax}>
        <form onSubmit={onSubmit} noValidate className={styles.dialogForm}>
          <DialogHeader showCloseButton={!pending}>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Categories group products in the menu and get their own SEO page.</DialogDescription>
          </DialogHeader>
          <DialogBody className={styles.dialogBodyStack}>
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
              className={styles.monoInput}
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
              containerClassName={styles.sortFieldContainer}
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
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)} className={styles.pillBtnGap}>
              <XIcon className={styles.iconMd} /> Cancel
            </Button>
            <Button type="submit" disabled={pending || !hasChanges} className={styles.pillBtnGap}>
              {pending ? <Loader2Icon className={styles.spinIcon} /> : <CheckIcon className={styles.iconMd} />} Save
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
      <div className={styles.topActionRow}>
        <Button
          size="sm"
          className={styles.addCategoryBtn}
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <PlusIcon className={styles.iconSm} /> Add category
        </Button>
      </div>

      <ul className={`adminCard ${styles.categoryList}`}>
        {categories.length === 0 && <li className={styles.categoryEmpty}>No categories yet.</li>}
        {categories.map((c) => (
          <li key={c.id} className={styles.categoryItem}>
            <span className={styles.categoryAvatar}>
              {c.name.charAt(0)}
            </span>
            <div className={styles.categoryInfo}>
              <p className={styles.categoryName}>{c.name}</p>
              <p className={styles.categoryMeta}>
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
              className={styles.deleteBtn}
              disabled={deletingId === c.id}
              onClick={() => setToDelete(c)}
            >
              {deletingId === c.id ? <Loader2Icon className={styles.spinIcon} /> : <Trash2Icon />}
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
