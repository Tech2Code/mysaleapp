"use client"

import { MicIcon, SearchIcon, XIcon } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type ComponentProps } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"
import styles from "./form.module.css"

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export type SearchFieldProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible name. Always visually hidden: a search box doesn't need a visible label. */
  label: string
  /** Shows a clear (×) button while there's text. */
  onClear?: () => void
  /** Shows a voice search (microphone) button when the browser supports Web Speech API. Defaults to true. */
  voiceSearch?: boolean
  fieldSize?: FieldSize
  pill?: boolean
  containerClassName?: string
}

/** Search box with icon, voice input (mic), and clear button. Pass `value` + `onChange` (controlled). */
export function SearchField({
  label,
  onClear,
  voiceSearch = true,
  fieldSize = "lg",
  pill,
  className,
  containerClassName,
  id: idProp,
  value,
  onChange,
  maxLength,
  placeholder = "Search…",
  ...props
}: SearchFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const latestOnChangeRef = useRef(onChange)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    latestOnChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (getSpeechRecognition()) {
      queueMicrotask(() => setSpeechSupported(true))
    }
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const toggleVoiceSearch = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) {
      toast.error("Voice search is not supported in this browser.")
      return
    }

    // Explicitly check and request microphone permission first so browsers show the permission prompt reliably
    if (typeof navigator !== "undefined") {
      try {
        if (navigator.permissions?.query) {
          const permStatus = await navigator.permissions
            .query({ name: "microphone" as PermissionName })
            .catch(() => null)
          if (permStatus?.state === "denied") {
            toast.error(
              "Microphone permission is blocked. Tap the lock/tune icon in your browser address bar and allow Microphone access."
            )
            return
          }
        }
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          for (const track of stream.getTracks()) {
            track.stop()
          }
        }
      } catch (err) {
        const errName = (err as { name?: string } | null)?.name ?? ""
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError" || errName === "SecurityError") {
          toast.error(
            "Microphone access is needed for voice search. Please allow Microphone permission in your browser settings."
          )
          return
        }
        if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          toast.error("No microphone found on this device.")
          return
        }
      }
    }

    try {
      recognitionRef.current?.abort()
      const recognition = new SpeechRecognitionCtor()
      recognitionRef.current = recognition
      recognition.lang = (typeof navigator !== "undefined" && navigator.language) || "en-IN"
      recognition.interimResults = true
      recognition.continuous = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        let transcript = Array.from(event.results)
          .map((res) => res[0]?.transcript ?? "")
          .join("")
          .trim()
        if (typeof maxLength === "number" && maxLength > 0) {
          transcript = transcript.slice(0, maxLength)
        }
        if (inputRef.current) {
          inputRef.current.value = transcript
        }
        const syntheticEvent = {
          target: { value: transcript },
          currentTarget: { value: transcript },
        } as ChangeEvent<HTMLInputElement>
        latestOnChangeRef.current?.(syntheticEvent)
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error(
            "Microphone access denied. Please allow Microphone permission from the browser address bar settings."
          )
        } else if (event.error === "audio-capture") {
          toast.error("No microphone found on this device.")
        } else if (event.error === "no-speech") {
          toast.info("No speech detected. Please try speaking again.")
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
        inputRef.current?.focus()
      }

      recognition.start()
    } catch {
      setIsListening(false)
      toast.error("Could not start voice search. Please try again.")
    }
  }, [isListening, maxLength])

  const handleClear = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      setIsListening(false)
    }
    onClear?.()
    inputRef.current?.focus()
  }, [isListening, onClear])

  const hasText = String(value ?? "").length > 0
  const showClear = Boolean(onClear && hasText && !props.disabled)
  const showVoice = Boolean(voiceSearch && speechSupported && !props.disabled)
  const actionCount = (showClear ? 1 : 0) + (showVoice ? 1 : 0)

  const formattedPlaceholder = isListening
    ? "Listening…"
    : placeholder && !placeholder.endsWith("…") && !placeholder.endsWith("...")
      ? `${placeholder.replace(/\.+$/, "")}…`
      : placeholder

  const paddingClass = pill
    ? cn(
        PILL,
        styles.searchInputPill,
        actionCount === 1 && styles.searchInputPillSingleAction,
        actionCount === 2 && styles.searchInputPillDualAction
      )
    : cn(
        FIELD_HEIGHT[fieldSize],
        actionCount === 2
          ? styles.searchInputDualAction
          : actionCount === 1
            ? styles.searchInputClearable
            : styles.searchInputDefault
      )

  return (
    <div className={cn(styles.searchContainer, containerClassName)}>
      <label htmlFor={id} className={styles.srOnly}>
        {label}
      </label>
      <SearchIcon
        aria-hidden="true"
        className={cn(styles.searchIconPos, pill ? styles.searchIconPill : styles.searchIconDefault)}
      />
      <Input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={formattedPlaceholder}
        className={cn(paddingClass, styles.searchInputBase, className)}
        {...props}
      />
      {actionCount > 0 && (
        <div

          className={cn(styles.searchActions, pill ? styles.searchActionsPill : styles.searchActionsDefault)}
        >
          {showClear && (
            <button

              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className={styles.clearSearchBtn}
            >
              <XIcon aria-hidden="true" className={styles.icon16} />
            </button>
          )}
          {showVoice && (
            <button

              type="button"
              onClick={toggleVoiceSearch}
              aria-label="Voice search"
              aria-pressed={isListening}
              className={cn(styles.voiceSearchBtn, isListening && styles.voiceSearchBtnActive)}
            >
              <MicIcon aria-hidden="true" className={styles.icon16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
