"use client"

import imageCompression from "browser-image-compression"
import { ArrowLeftIcon, ArrowRightIcon, ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react"
import Image from "next/image"
import { useId, useState } from "react"
import { toast } from "sonner"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const BUCKET = "product-images"
const MAX_IMAGES = 8
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"]

/**
 * Compresses photos in the browser (→ WebP, max 1600px, ~400KB) and uploads
 * them straight to Supabase Storage. Storage policies only allow admins to write.
 * The first image is used as the cover photo.
 */
export function ImageUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const inputId = useId()
  const [uploading, setUploading] = useState(0)

  const upload = async (files: FileList | null) => {
    const supabase = getBrowserSupabase()
    if (!files?.length || !supabase) return

    const room = MAX_IMAGES - value.length
    const picked = Array.from(files).filter((f) => ACCEPTED.includes(f.type)).slice(0, room)
    if (picked.length < files.length) toast.warning(`Only JPG/PNG/WebP images, up to ${MAX_IMAGES} per product.`)

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
      } catch {
        toast.error(`Couldn't upload ${file.name}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (urls.length) onChange([...value, ...urls])
  }

  const move = (from: number, to: number) => {
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <Image src={url} alt={`Product photo ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                Cover
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="grid size-7 place-items-center rounded-full bg-background/90 shadow disabled:opacity-30"
                aria-label="Move photo left"
              >
                <ArrowLeftIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                className="grid size-7 place-items-center rounded-full bg-destructive text-white shadow"
                aria-label="Remove photo"
              >
                <XIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === value.length - 1}
                className="grid size-7 place-items-center rounded-full bg-background/90 shadow disabled:opacity-30"
                aria-label="Move photo right"
              >
                <ArrowRightIcon className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {value.length < MAX_IMAGES && (
          <label
            htmlFor={inputId}
            className={cn(
              "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-within:border-primary",
              uploading > 0 && "pointer-events-none opacity-60"
            )}
          >
            {uploading > 0 ? <Loader2Icon className="size-6 animate-spin" /> : <ImagePlusIcon className="size-6" />}
            <span className="text-xs font-medium">{uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}</span>
            <input
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
      <p className="text-xs text-muted-foreground">
        Square or portrait photos look best. Images are compressed automatically. First photo is the cover.
      </p>
    </div>
  )
}
