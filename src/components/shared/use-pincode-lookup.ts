"use client"

import { CheckCircle2Icon, Loader2Icon } from "lucide-react"
import { createElement, useEffect, useRef, useState, type ReactNode } from "react"
import { lookupPincode, type PincodeInfo } from "@/features/location/actions"
import { PATTERNS } from "@/lib/validation"
import styles from "./shared.module.css"

const found = new Map<string, PincodeInfo>()

type Fields = {
  getCity: () => string
  setCity: (city: string) => void
  getState: () => string
  setState: (state: string) => void
}

/**
 * Fills City and State as soon as a full 6-digit pincode is typed.
 * A field is only written when it is empty or still holds what we filled in ourselves, so a value the
 * customer typed (or a saved address) is never overwritten.
 *
 *   const area = usePincodeLookup({ pincode, getCity, setCity, getState, setState })
 *   <TextField label="Pincode" hint={area.hint} … />
 */
export function usePincodeLookup({ pincode, overwrite = false, ...fields }: { pincode: string; overwrite?: boolean } & Fields) {
  const [result, setResult] = useState<{ pin: string; info: PincodeInfo } | null>(null)
  const filled = useRef({ pin: pincode, city: "", state: "" })
  const latest = useRef<Fields>(fields)
  useEffect(() => {
    latest.current = fields
  })

  const valid = PATTERNS.pincode.test(pincode)

  useEffect(() => {
    if (!PATTERNS.pincode.test(pincode)) return
    let stale = false
    const apply = (info: PincodeInfo) => {
      if (stale) return
      setResult({ pin: pincode, info })
      if (!info.ok) return
      const f = latest.current
      const pinChanged = filled.current.pin !== pincode
      const city = f.getCity().trim()
      if (overwrite || pinChanged || !city || city === filled.current.city) {
        filled.current.city = info.city
        if (city !== info.city) f.setCity(info.city)
      } else if (!filled.current.city) {
        filled.current.city = city
      }
      const state = f.getState()
      if (overwrite || pinChanged || !state || state === filled.current.state) {
        filled.current.state = info.state
        if (state !== info.state) f.setState(info.state)
      } else if (!filled.current.state) {
        filled.current.state = state
      }
      filled.current.pin = pincode
    }
    const cached = found.get(pincode)
    if (cached) queueMicrotask(() => apply(cached))
    else
      void lookupPincode(pincode)
        .then((info) => {
          if (info.ok) found.set(pincode, info)
          apply(info)
        })
        .catch(() => apply({ ok: false, reason: "unavailable" }))
    return () => {
      stale = true
    }
  }, [pincode, overwrite])

  const isInvalid = valid && result?.pin === pincode && !result.info.ok && result.info.reason === "invalid"
  const error = isInvalid ? "Enter a valid 6-digit Indian pincode" : undefined
  const loading = valid && result?.pin !== pincode
  const matched = valid && result?.pin === pincode && result.info.ok ? result.info : null
  const hint: ReactNode = loading
    ? createElement(
        "span",
        { className: styles.pincodeHintLoading },
        createElement(Loader2Icon, { className: styles.pincodeSpinSvg, "aria-hidden": true }),
        createElement("span", null, "Finding your area…")
      )
    : error
      ? undefined
      : matched
        ? createElement(
            "span",
            { className: styles.pincodeHintMatched },
            createElement(CheckCircle2Icon, { className: styles.pincodeCheckSvg, "aria-hidden": true }),
            createElement("span", null, `${matched.city}, ${matched.state} — filled from pincode`)
          )
        : "City / district and state are filled in from the pincode"
  return { loading, hint, error, matched: Boolean(matched) }
}
