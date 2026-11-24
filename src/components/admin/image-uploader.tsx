"use client"

import imageCompression from "browser-image-compression"
import { ArrowLeftIcon, ArrowRightIcon, ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import styles from "./admin-views.module.css"

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
  savedRef,
}: {
  value: string[]
  /** Accepts a new list, or an updater that receives the CURRENT list (uploads finish later than they start). */
  onChange: (urls: string[] | ((current: string[]) => string[])) => void
  /** True while photos are still uploading (the form must not be saved yet: they would be lost). */
  onUploadingChange?: (busy: boolean) => void
  /** Set to true by the parent form right before saving so newly uploaded files are kept when leaving the page. */
  savedRef?: React.RefObject<boolean>
}) {
  const inputId = useId()
  const [uploading, setUploading] = useState(0)
  const mountedRef = useRef(true)
  const sessionPaths = useRef<Map<string, string>>(new Map())
  const latestValueRef = useRef<string[]>(value)

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    mountedRef.current = true
    const sessionMap = sessionPaths.current
    const saved = savedRef
    return () => {
      mountedRef.current = false
      if (sessionMap.size === 0) return
      if (!saved?.current) {
        // Leaving or hiding (<Activity>) without saving: remove all newly uploaded files from this visit
        const paths = Array.from(sessionMap.values())
        sessionMap.clear()
        void getBrowserSupabase()?.storage.from(BUCKET).remove(paths)
      } else {
        // Saved: keep uploaded files that are in the final saved value; remove any that were discarded before saving
        const keptUrls = new Set(latestValueRef.current)
        const discardedPaths: string[] = []
        for (const [url, path] of sessionMap.entries()) {
          if (!keptUrls.has(url)) discardedPaths.push(path)
        }
        sessionMap.clear()
        if (discardedPaths.length > 0) {
          void getBrowserSupabase()?.storage.from(BUCKET).remove(discardedPaths)
        }
      }
    }
  }, [savedRef])

  useEffect(() => {
    onUploadingChange?.(uploading > 0)
  }, [uploading, onUploadingChange])

  const upload = async (files: FileList | null) => {
    const supabase = getBrowserSupabase()
    if (!files?.length || !supabase) return

    const room = MAX_IMAGES - latestValueRef.current.length
    const all = Array.from(files)
    const withinSize = all.filter((f) => f.size <= MAX_INPUT_BYTES)
    if (withinSize.length < all.length) toast.warning("Photos over 25 MB were skipped.")
    const validType = withinSize.filter((f) => ACCEPTED.includes(f.type))
    const picked = validType.slice(0, Math.max(0, room))
    if (picked.length < withinSize.length) {
      toast.warning(`Only JPG, PNG, WebP or AVIF photos, up to ${MAX_IMAGES} per product.`)
    }
    if (picked.length === 0) return

    setUploading((n) => n + picked.length)
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
        if (!mountedRef.current) {
          void supabase.storage.from(BUCKET).remove([path])
          return
        }
        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
        sessionPaths.current.set(publicUrl, path)
        urls.push(publicUrl)
      } catch (err) {
        // Show the real reason (e.g. "Bucket not found", RLS denial) so setup problems are obvious.
        const reason = err instanceof Error ? err.message : "unknown error"
        toast.error(`Couldn't upload ${file.name}: ${reason}`)
      } finally {
        if (mountedRef.current) setUploading((n) => Math.max(0, n - 1))
      }
    }
    if (mountedRef.current && urls.length) onChange((current) => [...current, ...urls].slice(0, MAX_IMAGES))
  }

  const removeImage = (url: string) => {
    const sessionPath = sessionPaths.current.get(url)
    if (sessionPath) {
      sessionPaths.current.delete(url)
      void getBrowserSupabase()?.storage.from(BUCKET).remove([sessionPath])
    }
    onChange((current) => current.filter((u) => u !== url))
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
    <div className={styles.uploaderRoot}>
      <div className={styles.photoGrid}>
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className={styles.photoItem}>
            {url.startsWith("data:") ? (
              <div className={styles.photoPlaceholder} />
            ) : (
              <Image src={url} alt={`Product photo ${i + 1}`} fill sizes="160px" className={styles.photoImg} />
            )}
            {i === 0 && (
              <span className={styles.coverBadge}>
                Cover
              </span>
            )}
            <div className={styles.photoControls}>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className={styles.photoMoveBtn}
                aria-label={`Move photo ${i + 1} left`}
              >
                <ArrowLeftIcon className={styles.iconSm} />
              </button>
              <button
                type="button"
                onClick={() => removeImage(url)}
                className={styles.photoRemoveBtn}
                aria-label={`Remove photo ${i + 1}`}
              >
                <XIcon className={styles.iconSm} />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === value.length - 1}
                className={styles.photoMoveBtn}
                aria-label={`Move photo ${i + 1} right`}
              >
                <ArrowRightIcon className={styles.iconSm} />
              </button>
            </div>
          </div>
        ))}

        {value.length < MAX_IMAGES && (
          <label
            htmlFor={inputId}
            className={cn(styles.uploadDropzone, uploading > 0 && styles.uploadDropzoneBusy)}
          >
            {uploading > 0 ? <Loader2Icon className={cn(styles.uploadIcon, styles.spinIcon)} /> : <ImagePlusIcon className={styles.uploadIcon} />}
            <span className={styles.uploadLabel}>{uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}</span>
            <input
              id={inputId}
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              disabled={uploading > 0}
              className={styles.srOnly}
              onChange={(e) => {
                void upload(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        )}
      </div>
      <p className={styles.uploaderHint}>
        Square or portrait photos look best. Images are compressed automatically. First photo is the cover.
      </p>
    </div>
  )
}
