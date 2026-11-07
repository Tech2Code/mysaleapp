"use client"

import imageCompression from "browser-image-compression"
import { ArrowLeftIcon, ArrowRightIcon, ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const BUCKET = "product-images"
const MAX_IMAGES = 8
const MAX_INPUT_BYTES = 25 * 1024 * 1024 // refuse huge originals before compressing in the browser
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"]

/**
 * Compresses photos in the browser (→ WebP, max 1600px, ~400KB) and uploads
 * them straight to Supabase Storage. Storage policies only allow admins to write.
 * The first image is used as the cover photo.
 */
export function ImageUploader({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string[]
  /** Accepts a new list, or an updater that receives the CURRENT list (uploads finish later than they start). */
  onChange: (urls: string[] | ((current: string[]) => string[])) => void
  /** True while photos are still uploading (the form must not be saved yet: they would be lost). */
  onUploadingChange?: (busy: boolean) => void
}) {
  const inputId = useId()
  const [uploading, setUploading] = useState(0)
  useEffect(() => {
    onUploadingChange?.(uploading > 0)
  }, [uploading, onUploadingChange])

  const upload = async (files: FileList | null) => {
    const supabase = getBrowserSupabase()
    if (!files?.length || !supabase) return

    const room = MAX_IMAGES - value.length
    const all = Array.from(files)
    if (all.some((f) => f.size > MAX_INPUT_BYTES)) toast.warning("Photos over 25 MB were skipped.")
    const picked = all.filter((f) => ACCEPTED.includes(f.type) && f.size <= MAX_INPUT_BYTES).slice(0, room)
    if (picked.length < all.length) toast.warning(`Only JPG, PNG, WebP or AVIF photos, up to ${MAX_IMAGES} per product.`)

    setUploading(picked.length)
    const urls: string[] = []
    for (const file of picked) {
      try {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1600,
          maxSizeMB: 0.4,
          fileType: "image/webp",
          useWebWorker: true,
        })
        const path = `products/${crypto.randomUUID()}.webp`
        const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
          contentType: "image/webp",
          cacheControl: "31536000",
        })
        if (error) throw error
        urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
      } catch (err) {
        // Show the real reason (e.g. "Bucket not found", RLS denial) so setup problems are obvious.
        const reason = err instanceof Error ? err.message : "unknown error"
        toast.error(`Couldn't upload ${file.name}: ${reason}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (urls.length) onChange((current) => [...current, ...urls].slice(0, MAX_IMAGES))
  }

  const move = (from: number, to: number) => {
    onChange((current) => {
      if (from < 0 || to < 0 || from >= current.length || to >= current.length) return current
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  return (
    <div data-ui="admin/ImageUploader" className="space-y-3">
      <div data-ui="admin/ImageUploader/div-grid" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, i) => (
          <div data-ui="admin/ImageUploader/div-relative" key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <Image data-ui="admin/ImageUploader/Image" src={url} alt={`Product photo ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && (
              <span data-ui="admin/ImageUploader/span-absolute" className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                Cover
              </span>
            )}
            <div data-ui="admin/ImageUploader/div-flex" className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button data-ui="admin/ImageUploader/button-grid"
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="grid size-7 place-items-center rounded-full bg-background/90 shadow disabled:opacity-30"
                aria-label={`Move photo ${i + 1} left`}
              >
                <ArrowLeftIcon className="size-3.5" />
              </button>
              <button data-ui="admin/ImageUploader/button-grid-2"
                type="button"
                onClick={() => onChange((current) => current.filter((u) => u !== url))}
                className="grid size-7 place-items-center rounded-full bg-destructive-solid text-white shadow"
                aria-label={`Remove photo ${i + 1}`}
              >
                <XIcon className="size-3.5" />
              </button>
              <button data-ui="admin/ImageUploader/button-grid-3"
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === value.length - 1}
                className="grid size-7 place-items-center rounded-full bg-background/90 shadow disabled:opacity-30"
                aria-label={`Move photo ${i + 1} right`}
              >
                <ArrowRightIcon className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {value.length < MAX_IMAGES && (
          <label data-ui="admin/ImageUploader/label"
            htmlFor={inputId}
            className={cn(
              "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-within:border-primary",
              uploading > 0 && "pointer-events-none opacity-60"
            )}
          >
            {uploading > 0 ? <Loader2Icon className="size-6 animate-spin" /> : <ImagePlusIcon className="size-6" />}
            <span data-ui="admin/ImageUploader/span" className="text-xs font-medium">{uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}</span>
            <input data-ui="admin/ImageUploader/input-file"
              id={inputId}
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                void upload(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        )}
      </div>
      <p data-ui="admin/ImageUploader/p" className="text-xs text-muted-foreground">
        Square or portrait photos look best. Images are compressed automatically. First photo is the cover.
      </p>
    </div>
  )
}
