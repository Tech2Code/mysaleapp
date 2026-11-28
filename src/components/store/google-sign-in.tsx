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
  ShieldCheckIcon,
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
import { SegmentedTabs } from "@/components/shared/segmented-tabs"
import { CheckboxField, TextField } from "@/components/form"
import { applyClientSignIn } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { LegalQuickModal, type LegalDocTab } from "@/components/shared/cookie-banner"
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
import { LIMITS, v } from "@/lib/validation"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import styles from "./google-sign-in.module.css"

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
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "Please accept the Terms of Service and Privacy Policy",
    }),
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
  { icon: HeartIcon, title: "Synced wishlist", text: "Access your saved favourites across every device." },
  { icon: MapPinIcon, title: "Faster checkout", text: "Use your saved delivery addresses and contact details." },
]

const SIGN_UP_PERKS = [
  { icon: UserCheckIcon, title: "One-time details setup", text: "Your name & mobile number auto-fill every time you order." },
  { icon: TruckIcon, title: "Address book for gifts & home", text: "Save multiple shipping addresses for quick repeat orders." },
  { icon: SparklesIcon, title: "Instant order history", text: "Keep all your past purchases, invoices, and returns together." },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.googleSvg} aria-hidden>
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
  const verifiedToastShownRef = useRef(false)
  useEffect(() => {
    const nextPath = safeNextPath(params.get("next"), "/")
    let errorParam = params.get("error")
    const verifiedParam = params.get("verified")
    const rawMode = params.get("mode")
    let initialMode: AuthMode | null =
      rawMode === "signup" || rawMode === "forgot" || rawMode === "reset-password"
        ? rawMode
        : null

    if (verifiedParam === "1" && !verifiedToastShownRef.current) {
      verifiedToastShownRef.current = true
      toast.success("Email verified! You can now sign in with your email and password.")
    }
    if (errorParam === "verify-expired") {
      errorParam = "That verification link has expired or was already used. Sign in or request a new link."
    }

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

    // Strip transient error/mode/token/verified/hash parameters from the browser address bar so the URL stays clean
    if (
      typeof window !== "undefined" &&
      (errorParam ||
        verifiedParam ||
        rawMode ||
        params.has("token") ||
        params.has("error_code") ||
        params.has("error_description") ||
        window.location.hash)
    ) {
      const clean = new URLSearchParams()
      if (rawMode === "reset-password") clean.set("mode", "reset-password")
      if (nextPath && nextPath !== "/") clean.set("next", nextPath)
      const qs = clean.toString()
      window.history.replaceState(null, "", qs ? `/login?${qs}` : "/login")
    }
  }, [params, onParams])
  return null
}

export function GoogleSignIn({
  shopName = "our store",
  resetToken = null,
}: {
  shopName?: string
  resetToken?: string | null
}) {
  const router = useRouter()
  const { user, ready } = useAuth()
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset-password" : "signin")
  const [activeResetToken, setActiveResetToken] = useState<string | null>(resetToken)
  const [prevResetToken, setPrevResetToken] = useState<string | null>(resetToken)
  if (resetToken !== prevResetToken) {
    setPrevResetToken(resetToken)
    if (resetToken) {
      setActiveResetToken(resetToken)
      setMode("reset-password")
    }
  }
  const [next, setNext] = useState("/")
  const [problem, setProblem] = useState<string | null>(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(pending)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [resetLinkSentTo, setResetLinkSentTo] = useState<string | null>(null)
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [legalModalTab, setLegalModalTab] = useState<LegalDocTab>("terms")
  const submittingRef = useRef(false)
  const recoveryLockRef = useRef(Boolean(resetToken))

  useEffect(() => {
    if (resetToken) {
      recoveryLockRef.current = true
    }
  }, [resetToken])

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })

  const signUpForm = useForm<SignUpValues, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", phone: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
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
      signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "", acceptTerms: false })
      forgotForm.reset({ email: "" })
      resetForm.reset({ next: "", confirm: "" })
      setConfirmationEmail(null)
      setResetLinkSentTo(null)
      setActiveResetToken(null)
      setProblem(null)
      setLoadingGoogle(false)
      setMode("signin")
    }
  }, [signInForm, signUpForm, forgotForm, resetForm])

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode !== "reset-password") {
      recoveryLockRef.current = false
      setActiveResetToken(null)
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
        const res = await signUpCustomer({ ...values, acceptTerms: true, next: targetNext, wishlistIds: localWishlistIds })
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
          signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "", acceptTerms: false })
          setMode("signin")
          later(() => toast.success("Confirmation link sent to your email"))
          return
        }

        signUpForm.reset({ fullName: "", phone: "", email: "", password: "", confirmPassword: "", acceptTerms: false })
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
        const res = await resetCustomerPassword({
          ...values,
          ...(activeResetToken ? { token: activeResetToken } : {}),
        })
        if (!res.ok) {
          submittingRef.current = false
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0] && (field === "next" || field === "confirm")) {
              resetForm.setError(field, { message: msgs[0] })
            }
          }
          toast.error(res.error)
          if (res.error.toLowerCase().includes("expired")) {
            recoveryLockRef.current = false
            setProblem("That password reset link has expired. Enter your email below to get a new one.")
            setMode("forgot")
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/login")
            }
          }
          return
        }
        resetForm.reset({ next: "", confirm: "" })
        recoveryLockRef.current = false
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/login")
        }
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?flow=oauth&next=${encodeURIComponent(targetNext)}` },
      })
      if (error) {
        setLoadingGoogle(false)
        toast.error("Could not start Google sign-in. Please try again.")
      }
    } catch {
      setLoadingGoogle(false)
      toast.error("Could not start Google sign-in. Please try again.")
    }
  }

  const perks = mode === "signup" ? SIGN_UP_PERKS : SIGN_IN_PERKS

  const handleSearchParams = useCallback(
    (nextPath: string, errorParam: string | null, initialMode: AuthMode | null) => {
      setNext(nextPath)
      if (errorParam) setProblem(errorParam)
      if (initialMode) {
        if (initialMode === "reset-password") {
          recoveryLockRef.current = true
        }
        setMode(initialMode)
      }
    },
    []
  )

  return (
    <div

      className={styles.authShell}
    >
      <Suspense fallback={null}>
        <SearchParamsSync onParams={handleSearchParams} />
      </Suspense>

      {/* Left Column: Dynamic Welcome & Perks Panel (Desktop only) */}
      <div
        className={styles.welcomeColumn}
      >
        <div>
          <div className={styles.logoRow}>
            <div className={styles.brandIdentityRow}>
              <LogoMark className={styles.logoBadge} />
              <div className={styles.brandNameMeta}>
                <p className={styles.brandShopTitle}>{shopName}</p>
                <p className={styles.brandSubTag}>Online Store</p>
              </div>
            </div>
            <span className={styles.modePill}>
              {mode === "signup" ? "New customer" : mode === "forgot" || mode === "reset-password" ? "Account recovery" : "Member access"}
            </span>
          </div>

          <h1 className={styles.welcomeTitle}>
            {mode === "signup"
              ? `Create your ${shopName} account`
              : mode === "forgot" || mode === "reset-password"
                ? "Recover your account access"
                : `Welcome back to ${shopName}`}
          </h1>
          <p className={styles.welcomeLead}>
            {mode === "signup"
              ? "Save your delivery details once so every future order is faster, simpler, and tracked in one place."
              : "Sign in with one-tap Google or your email to track live orders, manage addresses, and sync your saved favourites."}
          </p>

          <ul className={styles.perksList}>
            {perks.map((p) => (
              <li key={p.title} className={styles.perkItem}>
                <span className={styles.perkIconBadge}>
                  <p.icon className={styles.perkSvg} aria-hidden />
                </span>
                <div className={styles.perkTextCol}>
                  <p className={styles.perkTitle}>{p.title}</p>
                  <p className={styles.perkDesc}>{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.welcomeFooterBlock}>
          <div className={styles.trustStripRow}>
            <span className={styles.trustBadgeItem}>
              <ShieldCheckIcon className={styles.trustSvg} aria-hidden /> Secure &amp; encrypted
            </span>
            <span className={styles.trustBadgeItem}>
              <SparklesIcon className={styles.trustSvg} aria-hidden /> Instant wishlist sync
            </span>
          </div>
          <p className={styles.guestNoteDesktop}>
            Signing in is optional — you can also{" "}
            <Link href="/products" className={styles.guestLink}>
              browse &amp; order as a guest
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Right Column: Toggle + Form + Google OAuth */}
      <div className={styles.formColumn}>
        <div className={styles.formStack}>
          <div className={styles.mobileAuthHeader}>
            <div className={styles.mobileHeaderTop}>
              <LogoMark className={styles.mobileLogoBadge} />
              <span className={styles.modePill}>
                {mode === "signup" ? "New customer" : mode === "forgot" || mode === "reset-password" ? "Account recovery" : "Welcome back"}
              </span>
            </div>
            <h2 className={styles.formPanelTitle}>
              {mode === "signup"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : mode === "reset-password"
                    ? "Choose a new password"
                    : "Sign in to your account"}
            </h2>
            <p className={styles.formPanelSub}>
              {mode === "signup"
                ? "Fill in your details below or continue with Google in one tap."
                : mode === "forgot"
                  ? "We'll send a one-time recovery link to your registered email."
                  : mode === "reset-password"
                    ? "Enter a strong new password to secure your account."
                    : `Access your ${shopName} orders, saved addresses, and wishlist.`}
            </p>
          </div>

          {mode !== "reset-password" && (
            <SegmentedTabs
              layout="equal"
              shape="pill"
              ariaLabel="Account access"
              value={mode === "signup" ? "signup" : "signin"}
              onChange={(next) => switchMode(next)}
              items={[
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ]}
            />
          )}

          {(mode === "signin" || mode === "signup") && (
            <>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={signInWithGoogle}
                disabled={loadingGoogle || pending}
                className={styles.googleOauthBtn}
              >
                {loadingGoogle ? <Loader2Icon className={styles.googleSpinnerSvg} /> : <GoogleIcon />}
                {loadingGoogle ? "Opening Google…" : "Continue with Google"}
              </Button>

              <div className={styles.dividerRow}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerLabel}>
                  {mode === "signup" ? "or sign up with email" : "or sign in with email"}
                </span>
                <div className={styles.dividerLine} />
              </div>
            </>
          )}

          {problem && (
            <p role="alert" className={styles.problemAlert}>
              {problem === "cancelled"
                ? "Sign-in was cancelled, so you're not signed in yet. You can try again whenever you like."
                : problem === "expired"
                  ? "That password reset link has expired or was already used. Request a new one below."
                  : problem === "auth"
                    ? "We couldn't sign you in this time. Please try again."
                    : problem}
            </p>
          )}

          {confirmationEmail && (
            <p role="status" className={styles.confirmationBanner}>
              <MailCheckIcon className={styles.mailCheckSvg} aria-hidden />
              <span>
                We sent a confirmation link to <span className={styles.boldInline}>{confirmationEmail}</span>. Open the link in your email to activate your account, then sign in below.
              </span>
            </p>
          )}

          {mode === "signin" ? (
            <form key="signin" onSubmit={onSignIn} noValidate className={styles.authForm}>
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
              <div className={styles.forgotRow}>
                <button

                  type="button"
                  onClick={() => switchMode("forgot")}
                  className={styles.forgotLinkBtn}
                >
                  Forgot password?
                </button>
              </div>
              <Button

                type="submit"
                size="lg"
                disabled={pending || loadingGoogle}
                className={styles.primarySubmitBtn}
              >
                {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <LogInIcon className={styles.btnIcon} />}
                Sign in
              </Button>
            </form>
          ) : mode === "forgot" ? (
            resetLinkSentTo ? (
              <div role="status" className={styles.resetSentCard}>
                <p className={styles.resetSentTitle}>
                  <MailCheckIcon className={styles.resetMailSvg} aria-hidden /> Check your inbox
                </p>
                <p className={styles.resetSentBody}>
                  If an account exists for <span className={styles.boldEmail}>{resetLinkSentTo}</span>, a password reset link is on its way. Open the link in your email to choose a new password.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => switchMode("signin")}
                  className={styles.backPillBtn}
                >
                  <ArrowLeftIcon className={styles.backArrowSvg} /> Back to sign in
                </Button>
              </div>
            ) : (
              <form key="forgot" onSubmit={onForgotPassword} noValidate className={styles.authForm}>
                <p className={styles.helperText}>
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

                  type="submit"
                  size="lg"
                  disabled={pending || loadingGoogle}
                  className={styles.primarySubmitBtn}
                >
                  {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <SendIcon className={styles.btnIcon} />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={styles.backTextBtn}
                >
                  <ArrowLeftIcon className={styles.backArrowSvg} /> Back to sign in
                </button>
              </form>
            )
          ) : mode === "reset-password" ? (
            <form key="reset-password" onSubmit={onResetPassword} noValidate className={styles.authForm}>
              <p className={styles.helperText}>
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

                type="submit"
                size="lg"
                disabled={pending}
                className={styles.primarySubmitBtn}
              >
                {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <KeyRoundIcon className={styles.btnIcon} />}
                Save new password
              </Button>
            </form>
          ) : (
            <form key="signup" onSubmit={onSignUp} noValidate className={styles.signUpForm}>
              <div className={styles.twoColGrid}>
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
              <div className={styles.twoColGrid}>
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
              <p className={styles.passwordRuleNote}>
                Use at least {LIMITS.newPassword.min} characters with a letter and a number.
              </p>
              <CheckboxField
                containerClassName={styles.termsConsentWrap}
                labelClassName={styles.termsCheckboxLabel}
                error={signUpForm.formState.errors.acceptTerms?.message}
                {...signUpForm.register("acceptTerms")}
                label={
                  <>
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setLegalModalTab("terms")
                        setLegalModalOpen(true)
                      }}
                      className={styles.termsPolicyLink}
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setLegalModalTab("privacy")
                        setLegalModalOpen(true)
                      }}
                      className={styles.termsPolicyLink}
                    >
                      Privacy Policy
                    </button>
                    .
                  </>
                }
              />
              <Button

                type="submit"
                size="lg"
                disabled={pending || loadingGoogle}
                className={styles.primarySubmitBtn}
              >
                {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <UserPlusIcon className={styles.btnIcon} />}
                Create account
              </Button>
            </form>
          )}

          {mode !== "reset-password" && (
            <p className={styles.oauthLegalNote}>
              By continuing, you agree to our{" "}
              <button
                type="button"
                onClick={() => {
                  setLegalModalTab("terms")
                  setLegalModalOpen(true)
                }}
                className={styles.termsPolicyLink}
              >
                Terms
              </button>{" "}
              &amp;{" "}
              <button
                type="button"
                onClick={() => {
                  setLegalModalTab("privacy")
                  setLegalModalOpen(true)
                }}
                className={styles.termsPolicyLink}
              >
                Privacy Policy
              </button>
              .
            </p>
          )}

          <LegalQuickModal
            open={legalModalOpen}
            onOpenChange={setLegalModalOpen}
            initialTab={legalModalTab}
            onAccept={
              mode === "signup"
                ? () => {
                    signUpForm.setValue("acceptTerms", true, { shouldValidate: true, shouldDirty: true })
                    toast.success("Terms & Privacy Policy accepted.")
                  }
                : undefined
            }
          />

          <p className={styles.guestNoteMobile}>
            Signing in is optional —{" "}
            <Link href="/products" className={styles.guestLink}>
              browse &amp; order as a guest
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
