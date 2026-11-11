"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/safe-redirect"
import { useAuth } from "@/store/auth"

function GoogleIcon() {
  return (
    <svg data-ui="store/GoogleIcon" viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function GoogleSignIn() {
  const router = useRouter()
  const { user, ready } = useAuth()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const next = safeNextPath(params.get("next"), "/account/orders")
  const problem = params.get("error")

  useEffect(() => {
    if (ready && user) {
      router.replace(next)
    }
  }, [ready, user, router, next])

  // Pressing Back from Google's screen restores this page exactly as it was, spinner included. Reset it.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setLoading(false)
    const onVisible = () => document.visibilityState === "visible" && setLoading(false)
    window.addEventListener("pageshow", reset)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("pageshow", reset)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const signIn = async () => {
    const supabase = getBrowserSupabase()
    if (!supabase) {
      toast.error("Login is unavailable in demo mode. Connect Supabase first (see README).")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      setLoading(false)
      toast.error("Could not start Google sign-in. Please try again.")
    }
  }

  return (
    <div data-ui="store/GoogleSignIn" className="space-y-3">
      {problem && (
        <p data-ui="store/GoogleSignIn/p" role="alert" className="rounded-xl bg-muted p-3 text-sm">
          {problem === "cancelled"
            ? "Sign-in was cancelled, so you're not signed in yet. You can try again whenever you like."
            : "We couldn't sign you in this time. Please try again."}
        </p>
      )}
      <Button data-ui="store/GoogleSignIn/Button"
        type="button"
        size="lg"
        variant="outline"
        onClick={signIn}
        disabled={loading}
        className="h-13 w-full rounded-full bg-card text-base shadow-sm"
      >
        {loading ? <Loader2Icon className="size-5 animate-spin" /> : <GoogleIcon />}
        {loading ? "Opening Google…" : "Continue with Google"}
      </Button>
    </div>
  )
}
