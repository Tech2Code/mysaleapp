"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeftIcon,
  HeartIcon,
  KeyRoundIcon,
  Loader2Icon,
  LogInIcon,
  MailCheckIcon,
  MapPinIcon,
  PackageIcon,
  SendIcon,
  SparklesIcon,
  TruckIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextField } from "@/components/form"
import { applyClientSignIn } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { LogoMark } from "@/components/shared/logo"
import { Button } from "@/components/ui/button"
import {
  requestCustomerPasswordReset,
  resetCustomerPassword,
  signInCustomer,
  signUpCustomer,
} from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/safe-redirect"
import { cn } from "@/lib/utils"
import { LIMITS, v } from "@/lib/validation"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"

const signInSchema = z.object({
  email: v.email(),
  password: v.password(),
})

const signUpSchema = z
  .object({
    fullName: v.personName("full name"),
    phone: v.phoneIN(),
    email: v.email(),
    password: v.newPassword(),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.input<typeof signUpSchema>

const forgotSchema = z.object({
  email: v.email(),
})
type ForgotValues = z.infer<typeof forgotSchema>

const resetPasswordSchema = z
  .object({
    next: v.newPassword(),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

type AuthMode = "signin" | "signup" | "forgot" | "reset-password"

const SIGN_IN_PERKS = [
  { icon: PackageIcon, title: "Live order tracking", text: "Check real-time status and courier updates in one place." },
  { icon: HeartIcon, title: "Synced wishlist", text: "Access your saved handmade favourites across every device." },
  { icon: MapPinIcon, title: "Faster checkout", text: "Use your saved delivery addresses and contact details." },
]

const SIGN_UP_PERKS = [
  { icon: UserCheckIcon, title: "One-time details setup", text: "Your name & mobile number auto-fill every time you order." },
  { icon: TruckIcon, title: "Address book for gifts & home", text: "Save multiple shipping addresses for quick repeat orders." },
  { icon: SparklesIcon, title: "Instant order history", text: "Keep all your past purchases, invoices, and returns together." },
]

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

function SearchParamsSync({
  onParams,
}: {
  onParams: (nextPath: string, errorParam: string | null, initialMode: AuthMode | null) => void
}) {
  const params = useSearchParams()
  useEffect(() => {
    const nextPath = safeNextPath(params.get("next"), "/")
    let errorParam = params.get("error")
    const rawMode = params.get("mode")
    let initialMode: AuthMode | null =
      rawMode === "signup" || rawMode === "forgot" || rawMode === "reset-password"
        ? rawMode
        : null

    if (typeof window !== "undefined") {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const errCode = params.get("error_code") || hashParams.get("error_code")
      const errDesc = (
        params.get("error_description") ||
        hashParams.get("error_description") ||
        ""
      ).toLowerCase()
      if (errCode === "otp_expired" || errDesc.includes("expired") || errDesc.includes("invalid")) {
        errorParam = "expired"
        if (!initialMode) initialMode = "forgot"
      } else if (!errorParam && hashParams.get("error")) {
        errorParam = hashParams.get("error") === "access_denied" ? "cancelled" : "auth"
      }
    }

    onParams(nextPath, errorParam, initialMode)

    // Strip transient error/mode/hash parameters from the browser address bar so the URL stays clean
    if (
      typeof window !== "undefined" &&
      (errorParam ||
        rawMode ||
        params.has("error_code") ||
        params.has("error_description") ||
        window.location.hash)
    ) {
      const clean = new URLSearchParams()
      if (nextPath && nextPath !== "/") clean.set("next", nextPath)
      const qs = clean.toString()
      window.history.replaceState(null, "", qs ? `/login?${qs}` : "/login")
    }
  }, [params, onParams])
  return null
}

export function GoogleSignIn({ shopName = "our store" }: { shopName?: string }) {
  const router = useRouter()
  const { user, ready } = useAuth()
  const [mode, setMode] = useState<AuthMode>("signin")
  const [next, setNext] = useState("/")
  const [problem, setProblem] = useState<string | null>(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(pending)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [resetLinkSentTo, setResetLinkSentTo] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const recoveryLockRef = useRef(false)

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })

  const signUpForm = useForm<SignUpValues, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", phone: "", email: "", password: "", confirmPassword: "" },
  })

  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { next: "", confirm: "" },
  })

  const resolveNext = useCallback(() => {
    if (typeof window === "undefined") return next
    return safeNextPath(new URLSearchParams(window.location.search).get("next"), next)
  }, [next])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlMode = new URLSearchParams(window.location.search).get("mode")
      if (urlMode === "reset-password") {
        recoveryLockRef.current = true
        return
      }
    }
    if (
      ready &&
      user &&
      mode !== "reset-password" &&
      !recoveryLockRef.current &&
      !pending &&
      !submittingRef.current
    ) {
      router.replace(resolveNext())
    }
  }, [ready, user, mode, pending, router, resolveNext])

  // Pressing Back from Google's screen restores this page exactly as it was, spinner included. Reset it.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setLoadingGoogle(false)
    const onVisible = () => document.visibilityState === "visible" && setLoadingGoogle(false)
    window.addEventListener("pageshow", reset)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("pageshow", reset)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  // Clear all form fields & transient state when leaving `/login` (including Next.js <Activity> hide)
  useLayoutEffect(() => {
    return () => {
      submittingRef.current = false
      recoveryLockRef.current = false
      signInForm.reset({ email: "", password: "" })
      signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "" })
      forgotForm.reset({ email: "" })
      resetForm.reset({ next: "", confirm: "" })
      setConfirmationEmail(null)
      setResetLinkSentTo(null)
      setLoadingGoogle(false)
      setMode("signin")
    }
  }, [signInForm, signUpForm, forgotForm, resetForm])

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode !== "reset-password") {
      recoveryLockRef.current = false
    }
    if (nextMode === "forgot") {
      const currentEmail = signInForm.getValues("email").trim()
      if (currentEmail && !forgotForm.getValues("email")) {
        forgotForm.setValue("email", currentEmail)
      }
    }
    setMode(nextMode)
    setProblem(null)
    setConfirmationEmail(null)
    setResetLinkSentTo(null)
  }

  const onSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    void signInForm.handleSubmit((values) => {
      submittingRef.current = true
      startTransition(async () => {
        const { ids: storedIds, ownerId } = useWishlist.getState()
        const localWishlistIds = ownerId === null ? storedIds : []
        const res = await signInCustomer({ ...values, wishlistIds: localWishlistIds })
        if (!res.ok) {
          submittingRef.current = false
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0] && (field === "email" || field === "password")) {
              signInForm.setError(field, { message: msgs[0] })
            }
          }
          toast.error(res.error)
          return
        }
        signInForm.reset({ email: "", password: "" })
        applyClientSignIn(res.data.user, res.data.wishlistIds)
        showSuccess("Signed in")
        later(() =>
          toast.success(
            res.data.reactivated
              ? "Welcome back! Your deactivated account has been restored."
              : "Signed in successfully"
          )
        )
        router.replace(resolveNext())
      })
    })(e)
  }

  const onSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    void signUpForm.handleSubmit((values) => {
      submittingRef.current = true
      startTransition(async () => {
        setConfirmationEmail(null)
        const targetNext = resolveNext()
        const { ids: storedIds, ownerId } = useWishlist.getState()
        const localWishlistIds = ownerId === null ? storedIds : []
        const res = await signUpCustomer({ ...values, next: targetNext, wishlistIds: localWishlistIds })
        if (!res.ok) {
          submittingRef.current = false
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0] && field in values) {
              signUpForm.setError(field as keyof SignUpValues, { message: msgs[0] })
            }
          }
          toast.error(res.error)
          return
        }

        if (res.data.needsEmailConfirmation) {
          submittingRef.current = false
          setConfirmationEmail(values.email)
          signInForm.setValue("email", values.email)
          signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "" })
          setMode("signin")
          later(() => toast.success("Confirmation link sent to your email"))
          return
        }

        signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "" })
        if (res.data.user) {
          applyClientSignIn(res.data.user, res.data.wishlistIds)
        }
        showSuccess("Account created")
        later(() => toast.success("Welcome! Your account has been created."))
        router.replace(targetNext)
      })
    })(e)
  }

  const onForgotPassword = (e: React.FormEvent<HTMLFormElement>) => {
    void forgotForm.handleSubmit((values) => {
      startTransition(async () => {
        const res = await requestCustomerPasswordReset({
          email: values.email,
          next: resolveNext(),
        })
        if (!res.ok) {
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0] && field === "email") {
              forgotForm.setError("email", { message: msgs[0] })
            }
          }
          toast.error(res.error)
          return
        }
        setResetLinkSentTo(values.email)
        later(() => toast.success("Password reset link sent"))
      })
    })(e)
  }

  const onResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    void resetForm.handleSubmit((values) => {
      submittingRef.current = true
      startTransition(async () => {
        const res = await resetCustomerPassword(values)
        if (!res.ok) {
          submittingRef.current = false
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0] && (field === "next" || field === "confirm")) {
              resetForm.setError(field, { message: msgs[0] })
            }
          }
          toast.error(res.error)
          return
        }
        resetForm.reset({ next: "", confirm: "" })
        recoveryLockRef.current = false
        applyClientSignIn(res.data.user)
        showSuccess("Password updated")
        later(() =>
          toast.success(
            res.data.reactivated
              ? "Your password has been updated and your deactivated account has been restored."
              : "Your password has been updated."
          )
        )
        router.replace(resolveNext())
      })
    })(e)
  }

  const signInWithGoogle = async () => {
    const supabase = getBrowserSupabase()
    if (!supabase) {
      toast.error("Login is unavailable in demo mode. Connect Supabase first (see README).")
      return
    }
    setLoadingGoogle(true)
    const targetNext = resolveNext()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?flow=oauth&next=${encodeURIComponent(targetNext)}` },
    })
    if (error) {
      setLoadingGoogle(false)
      toast.error("Could not start Google sign-in. Please try again.")
    }
  }

  const perks = mode === "signup" ? SIGN_UP_PERKS : SIGN_IN_PERKS

  return (
    <div
      data-ui="store/GoogleSignIn"
      className="grid w-full max-w-4xl overflow-hidden rounded-4xl border bg-card/90 shadow-2xl shadow-black/5 backdrop-blur lg:grid-cols-[0.95fr_1.05fr]"
    >
      <Suspense fallback={null}>
        <SearchParamsSync
          onParams={(nextPath, errorParam, initialMode) => {
            setNext(nextPath)
            if (errorParam) setProblem(errorParam)
            if (initialMode) {
              if (initialMode === "reset-password") {
                recoveryLockRef.current = true
              }
              setMode(initialMode)
            }
          }}
        />
      </Suspense>

      {/* Left Column: Dynamic Welcome & Perks Panel (Desktop only) */}
      <div
        data-ui="store/GoogleSignIn/div-hidden"
        className="hidden flex-col justify-between border-r border-border/60 bg-secondary/40 p-7 lg:flex"
      >
        <div data-ui="store/GoogleSignIn/div">
          <div data-ui="store/GoogleSignIn/div-flex" className="flex items-center gap-3">
            <LogoMark className="size-11 text-xl" />
            <span data-ui="store/GoogleSignIn/span" className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {mode === "signup" ? "New customer" : mode === "forgot" || mode === "reset-password" ? "Account recovery" : "Welcome back"}
            </span>
          </div>

          <h1 data-ui="store/GoogleSignIn/h1" className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            {mode === "signup" ? `Join ${shopName}` : `Welcome to ${shopName}`}
          </h1>
          <p data-ui="store/GoogleSignIn/p" className="mt-2 text-sm/relaxed text-muted-foreground">
            {mode === "signup"
              ? "Create your account with your basic details once so every future order is faster and easier."
              : "Sign in with your email and password or one-tap Google login to manage your orders and saved items."}
          </p>

          <ul data-ui="store/GoogleSignIn/ul" className="mt-7 space-y-4">
            {perks.map((p) => (
              <li data-ui="store/GoogleSignIn/li-flex" key={p.title} className="flex items-start gap-3.5">
                <span data-ui="store/GoogleSignIn/span-grid" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-2xl bg-card text-primary shadow-xs ring-1 ring-border/60">
                  <p.icon data-ui="store/GoogleSignIn/p.icon" className="size-4" aria-hidden />
                </span>
                <div data-ui="store/GoogleSignIn/div-2" className="space-y-0.5">
                  <p data-ui="store/GoogleSignIn/p-2" className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p data-ui="store/GoogleSignIn/p-3" className="text-xs/relaxed text-muted-foreground">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p data-ui="store/GoogleSignIn/p-4" className="mt-8 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          Signing in is optional — you can also{" "}
          <Link data-ui="store/GoogleSignIn/Link-browse-amp-order-as-a-" href="/products" className="font-semibold text-primary underline-offset-4 hover:underline">
            browse &amp; order as a guest
          </Link>
          .
        </p>
      </div>

      {/* Right Column: Toggle + Form + Google OAuth */}
      <div data-ui="store/GoogleSignIn/div-flex-2" className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
        <div data-ui="store/GoogleSignIn/div-3" className="space-y-4">
          {mode !== "reset-password" && (
            <div
              data-ui="store/GoogleSignIn/div-account-access"
              role="group"
              aria-label="Account access"
              className="grid grid-cols-2 rounded-full border bg-muted/60 p-1 text-sm font-medium"
            >
              <button
                data-ui="store/GoogleSignIn/button-sign-in"
                type="button"
                aria-pressed={mode === "signin"}
                onClick={() => switchMode("signin")}
                className={cn(
                  "h-9 rounded-full transition",
                  mode === "signin" ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign in
              </button>
              <button
                data-ui="store/GoogleSignIn/button-create-account"
                type="button"
                aria-pressed={mode === "signup"}
                onClick={() => switchMode("signup")}
                className={cn(
                  "h-9 rounded-full transition",
                  mode === "signup" ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Create account
              </button>
            </div>
          )}

          {problem && (
            <p data-ui="store/GoogleSignIn/p-5" role="alert" className="rounded-xl bg-muted p-3 text-sm">
              {problem === "cancelled"
                ? "Sign-in was cancelled, so you're not signed in yet. You can try again whenever you like."
                : problem === "expired"
                  ? "That password reset link has expired or was already used. Request a new one below."
                  : "We couldn't sign you in this time. Please try again."}
            </p>
          )}

          {confirmationEmail && (
            <p data-ui="store/GoogleSignIn/p-flex" role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
              <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span data-ui="store/GoogleSignIn/span-2">
                We sent a confirmation link to <span data-ui="store/GoogleSignIn/span-3" className="font-semibold">{confirmationEmail}</span>. Open the link in your email to activate your account, then sign in below.
              </span>
            </p>
          )}

          {mode === "signin" ? (
            <form key="signin" data-ui="store/GoogleSignIn/form" onSubmit={onSignIn} noValidate className="space-y-2.5">
              <TextField
                label="Email"
                kind="email"
                type="email"
                autoComplete="email"
                error={signInForm.formState.errors.email?.message}
                {...signInForm.register("email")}
              />
              <TextField
                label="Password"
                type="password"
                maxLength={LIMITS.password.max}
                autoComplete="current-password"
                error={signInForm.formState.errors.password?.message}
                {...signInForm.register("password")}
              />
              <div data-ui="store/GoogleSignIn/div-flex-3" className="flex justify-end pt-0.5 text-xs">
                <button
                  data-ui="store/GoogleSignIn/button-forgot-password"
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Button
                data-ui="store/GoogleSignIn/Button-sign-in"
                type="submit"
                size="lg"
                disabled={pending || loadingGoogle}
                className="mt-1 h-11 w-full gap-2 rounded-full"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : <LogInIcon className="size-4" />}
                Sign in
              </Button>
            </form>
          ) : mode === "forgot" ? (
            resetLinkSentTo ? (
              <div data-ui="store/GoogleSignIn/div-4" role="status" className="space-y-3 rounded-2xl bg-success/10 p-4 text-sm">
                <p data-ui="store/GoogleSignIn/p-flex-2" className="flex items-center gap-2 font-semibold">
                  <MailCheckIcon className="size-4 text-success" aria-hidden /> Check your inbox
                </p>
                <p data-ui="store/GoogleSignIn/p-6">
                  If an account exists for <span data-ui="store/GoogleSignIn/span-4" className="font-semibold">{resetLinkSentTo}</span>, a password reset link is on its way. Open the link in your email to choose a new password.
                </p>
                <Button data-ui="store/GoogleSignIn/Button-back-to-sign-in"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => switchMode("signin")}
                  className="rounded-full"
                >
                  <ArrowLeftIcon className="size-3.5" /> Back to sign in
                </Button>
              </div>
            ) : (
              <form key="forgot" data-ui="store/GoogleSignIn/form-2" onSubmit={onForgotPassword} noValidate className="space-y-2.5">
                <p data-ui="store/GoogleSignIn/p-7" className="text-xs text-muted-foreground">
                  Enter the email address for your account and we&apos;ll send you a link to reset your password.
                </p>
                <TextField
                  label="Email"
                  kind="email"
                  type="email"
                  autoComplete="email"
                  error={forgotForm.formState.errors.email?.message}
                  {...forgotForm.register("email")}
                />
                <Button
                  data-ui="store/GoogleSignIn/Button-send-reset-link"
                  type="submit"
                  size="lg"
                  disabled={pending || loadingGoogle}
                  className="mt-1 h-11 w-full gap-2 rounded-full"
                >
                  {pending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  Send reset link
                </Button>
                <button data-ui="store/GoogleSignIn/button-back-to-sign-in"
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeftIcon className="size-3.5" /> Back to sign in
                </button>
              </form>
            )
          ) : mode === "reset-password" ? (
            <form key="reset-password" data-ui="store/GoogleSignIn/form-3" onSubmit={onResetPassword} noValidate className="space-y-2.5">
              <p data-ui="store/GoogleSignIn/p-8" className="text-xs text-muted-foreground">
                Choose a new password for your account. You&apos;ll be signed in right after.
              </p>
              <TextField
                label="New password"
                type="password"
                maxLength={LIMITS.password.max}
                autoComplete="new-password"
                hint={`At least ${LIMITS.newPassword.min} characters, with a letter and a number.`}
                error={resetForm.formState.errors.next?.message}
                {...resetForm.register("next")}
              />
              <TextField
                label="Confirm new password"
                type="password"
                maxLength={LIMITS.password.max}
                autoComplete="new-password"
                error={resetForm.formState.errors.confirm?.message}
                {...resetForm.register("confirm")}
              />
              <Button
                data-ui="store/GoogleSignIn/Button-save-new-password"
                type="submit"
                size="lg"
                disabled={pending}
                className="mt-1 h-11 w-full gap-2 rounded-full"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : <KeyRoundIcon className="size-4" />}
                Save new password
              </Button>
            </form>
          ) : (
            <form key="signup" data-ui="store/GoogleSignIn/form-4" onSubmit={onSignUp} noValidate className="space-y-2">
              <div data-ui="store/GoogleSignIn/div-grid" className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
                <TextField
                  label="Full name"
                  kind="personName"
                  autoComplete="name"
                  error={signUpForm.formState.errors.fullName?.message}
                  {...signUpForm.register("fullName")}
                />
                <TextField
                  label="Mobile number"
                  kind="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  leading="+91"
                  error={signUpForm.formState.errors.phone?.message}
                  {...signUpForm.register("phone")}
                />
              </div>
              <TextField
                label="Email"
                kind="email"
                type="email"
                autoComplete="email"
                error={signUpForm.formState.errors.email?.message}
                {...signUpForm.register("email")}
              />
              <div data-ui="store/GoogleSignIn/div-grid-2" className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
                <TextField
                  label="Password"
                  type="password"
                  maxLength={LIMITS.password.max}
                  autoComplete="new-password"
                  error={signUpForm.formState.errors.password?.message}
                  {...signUpForm.register("password")}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  maxLength={LIMITS.password.max}
                  autoComplete="new-password"
                  error={signUpForm.formState.errors.confirmPassword?.message}
                  {...signUpForm.register("confirmPassword")}
                />
              </div>
              <p data-ui="store/GoogleSignIn/p-9" className="text-[0.72rem] text-muted-foreground">
                Use at least {LIMITS.newPassword.min} characters with a letter and a number.
              </p>
              <Button
                data-ui="store/GoogleSignIn/Button-create-account"
                type="submit"
                size="lg"
                disabled={pending || loadingGoogle}
                className="mt-1 h-11 w-full gap-2 rounded-full"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : <UserPlusIcon className="size-4" />}
                Create account
              </Button>
            </form>
          )}

          {mode !== "reset-password" && (
            <>
              <div data-ui="store/GoogleSignIn/div-flex-4" className="relative flex items-center py-1">
                <div data-ui="store/GoogleSignIn/div-5" className="grow border-t border-border/70" />
                <span data-ui="store/GoogleSignIn/span-5" className="mx-3 shrink-0 text-xs text-muted-foreground">or continue with</span>
                <div data-ui="store/GoogleSignIn/div-6" className="grow border-t border-border/70" />
              </div>

              <Button
                data-ui="store/GoogleSignIn/Button"
                type="button"
                size="lg"
                variant="outline"
                onClick={signInWithGoogle}
                disabled={loadingGoogle || pending}
                className="h-11 w-full rounded-full bg-card text-sm shadow-sm"
              >
                {loadingGoogle ? <Loader2Icon className="size-5 animate-spin" /> : <GoogleIcon />}
                {loadingGoogle ? "Opening Google…" : "Continue with Google"}
              </Button>
            </>
          )}

          <p data-ui="store/GoogleSignIn/p-10" className="pt-1 text-center text-xs text-muted-foreground lg:hidden">
            Signing in is optional —{" "}
            <Link data-ui="store/GoogleSignIn/Link-browse-amp-order-as-a--2" href="/products" className="font-semibold text-primary underline-offset-4 hover:underline">
              browse &amp; order as a guest
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
