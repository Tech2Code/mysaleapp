"use client"

import { useEffect, useRef, useState } from "react"
import { lookupPincode, type PincodeInfo } from "@/features/location/actions"
import { PATTERNS } from "@/lib/validation"

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
export function usePincodeLookup({ pincode, ...fields }: { pincode: string } & Fields) {
  const [result, setResult] = useState<{ pin: string; info: PincodeInfo } | null>(null)
  const filled = useRef({ city: "", state: "" })
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
      const city = f.getCity().trim()
      if (!city || city === filled.current.city) {
        filled.current.city = info.city
        f.setCity(info.city)
      }
      const state = f.getState()
      if (!state || state === filled.current.state) {
        filled.current.state = info.state
        f.setState(info.state)
      }
    }
    const cached = found.get(pincode)
    if (cached) queueMicrotask(() => apply(cached))
    else
      void lookupPincode(pincode).then((info) => {
        if (info.ok) found.set(pincode, info)
        apply(info)
      })
    return () => {
      stale = true
    }
  }, [pincode])

  const loading = valid && result?.pin !== pincode
  const hint = loading ? "Finding your area…" : "City and state are filled in from the pincode"
  return { loading, hint }
}
