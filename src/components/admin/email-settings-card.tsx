"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  Loader2Icon,
  MailIcon,
  SaveIcon,
  SendIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { SwitchField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { clearEmailAppPassword, saveEmailSettings, sendTestEmail } from "@/features/email/actions"
import {
  emailSettingsSchema,
  type EmailSettingsInput,
  type EmailSettingsPublic,
  type EmailSettingsValues,
} from "@/features/email/schema"
import { useToastAfter } from "@/hooks/use-toast-after"
import { cn } from "@/lib/utils"
import styles from "./email-settings-card.module.css"

function toFormDefaults(s: EmailSettingsPublic): EmailSettingsInput {
  return {
    enabled: s.enabled,
    gmailUser: s.gmailUser ?? "",
    gmailAppPassword: "",
    senderName: s.senderName ?? "",
    replyTo: s.replyTo ?? "",
  }
}

function formatTestedTime(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso))
  } catch {
    return null
  }
}

export function EmailSettingsCard({
  initialSettings,
  shopName,
  defaultRecipient,
}: {
  initialSettings: EmailSettingsPublic
  shopName: string
  defaultRecipient?: string | null
}) {
  const router = useRouter()
  const [settings, setSettings] = useState<EmailSettingsPublic>(initialSettings)
  const [prevInitial, setPrevInitial] = useState<EmailSettingsPublic>(initialSettings)
  const [saving, startSaving] = useTransition()

  if (initialSettings !== prevInitial) {
    setPrevInitial(initialSettings)
    setSettings(initialSettings)
  }
  const [testing, startTesting] = useTransition()
  const [clearing, startClearing] = useTransition()
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [testRecipient, setTestRecipient] = useState(
    defaultRecipient?.trim() || initialSettings.gmailUser || ""
  )

  const busy = saving || testing || clearing
  useBlockWhile(busy)
  const laterSave = useToastAfter(saving)
  const laterTest = useToastAfter(testing)
  const laterClear = useToastAfter(clearing)

  const form = useForm<EmailSettingsInput, unknown, EmailSettingsValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: toFormDefaults(initialSettings),
  })

  useEffect(() => {
    // Only reset form when core saved settings change (never wipe unsaved input after a test email)
    if (!form.formState.isDirty) {
      form.reset(toFormDefaults(settings))
    }
  }, [settings, form])

  const { errors, isDirty } = form.formState
  const isActive = settings.migrationReady && settings.enabled && Boolean(settings.gmailUser) && settings.hasAppPassword
  const testedLabel = formatTestedTime(settings.lastTestAt)

  const onSubmit = form.handleSubmit((values) => {
    startSaving(async () => {
      const res = await saveEmailSettings(values)
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) {
            form.setError(field as keyof EmailSettingsInput, { message: messages[0] })
          }
        }
        return
      }
      setSettings(res.data.settings)
      form.reset(toFormDefaults(res.data.settings))
      if (!testRecipient.trim() && res.data.settings.gmailUser) {
        setTestRecipient(res.data.settings.gmailUser)
      }
      laterSave(() =>
        toast.success(
          res.data.settings.enabled
            ? "Gmail SMTP settings saved and enabled."
            : "Email settings saved."
        )
      )
      router.refresh()
    })
  })

  const onSendTest = () => {
    const recipient = testRecipient.trim()
    if (!recipient || !recipient.includes("@")) {
      toast.error("Enter a valid email address to receive the test email.")
      return
    }
    const vals = form.getValues()
    startTesting(async () => {
      const res = await sendTestEmail({
        recipientEmail: recipient,
        gmailUser: vals.gmailUser,
        gmailAppPassword: vals.gmailAppPassword,
        senderName: vals.senderName,
        replyTo: vals.replyTo,
      })
      if (!res.ok) {
        setSettings((prev) => ({
          ...prev,
          lastTestAt: new Date().toISOString(),
          lastTestStatus: "error",
          lastTestError: res.error,
        }))
        laterTest(() => toast.error(res.error))
        return
      }
      setSettings((prev) => ({
        ...prev,
        lastTestAt: res.data.testedAt,
        lastTestStatus: "ok",
        lastTestError: null,
      }))
      laterTest(() => toast.success(`Test email sent to ${res.data.recipientEmail}. Check your inbox!`))
    })
  }

  const onConfirmClearPassword = () => {
    startClearing(async () => {
      const res = await clearEmailAppPassword()
      setClearDialogOpen(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setSettings(res.data.settings)
      form.reset(toFormDefaults(res.data.settings))
      laterClear(() => toast.success("Saved Gmail App Password removed and SMTP disabled."))
      router.refresh()
    })
  }

  return (
    <section className={cn("adminCard", styles.emailSection)} aria-labelledby="email-settings-heading">
      <div className={styles.emailHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.iconBox}>
            <MailIcon className={styles.iconMd} aria-hidden />
          </span>
          <div className={styles.titleGroup}>
            <h2 id="email-settings-heading" className={styles.sectionTitle}>
              Email &amp; Gmail SMTP
            </h2>
            <p className={styles.sectionDesc}>
              Send forgot-password, reset-password, and security emails directly through your Gmail account using a 16-character Google App Password.
            </p>
          </div>
        </div>
        {!settings.migrationReady ? (
          <span className={cn(styles.statusBadge, styles.statusWarn)}>
            <span className={styles.statusDot} aria-hidden />
            Migration pending
          </span>
        ) : isActive ? (
          <span className={cn(styles.statusBadge, styles.statusActive)}>
            <span className={styles.statusDot} aria-hidden />
            Gmail SMTP active
          </span>
        ) : (
          <span className={cn(styles.statusBadge, styles.statusInactive)}>
            <span className={styles.statusDot} aria-hidden />
            Disabled
          </span>
        )}
      </div>

      {!settings.migrationReady && (
        <div role="alert" className={styles.migrationBanner}>
          <AlertTriangleIcon className={styles.bannerIcon} aria-hidden />
          <div>
            Database migration <code className={styles.inlineCode}>0070_email_settings.sql</code> hasn&apos;t been applied yet. Push it with{" "}
            <code className={styles.inlineCode}>npm run db:push</code> before saving Gmail SMTP settings. Until then, password resets fall back to Supabase&apos;s default sender.
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className={styles.emailForm}>
        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <SwitchField
              label="Enable Gmail SMTP for password resets & emails"
              description="When turned on, customer and admin forgot-password links are delivered from your Gmail account instead of Supabase's 3-email/hour free sender."
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={!settings.migrationReady || busy}
            />
          )}
        />

        <div className={styles.fieldsGrid}>
          <TextField
            label="Gmail address"
            kind="email"
            type="email"
            fieldSize="md"
            placeholder="yourshop@gmail.com"
            autoComplete="email"
            hint="The Gmail or Google Workspace address that sends your store's emails."
            disabled={!settings.migrationReady || busy}
            error={errors.gmailUser?.message}
            {...form.register("gmailUser")}
          />

          <div className={styles.passwordFieldCol}>
            <TextField
              label="Gmail App Password"
              type="password"
              fieldSize="md"
              autoComplete="new-password"
              placeholder={
                settings.hasAppPassword
                  ? "Saved — enter a new 16-char code to replace"
                  : "xxxx xxxx xxxx xxxx"
              }
              hint="16-character Google App Password (spaces are ignored). Encrypted before saving and never shown again."
              disabled={!settings.migrationReady || busy}
              error={errors.gmailAppPassword?.message}
              {...form.register("gmailAppPassword")}
            />
            {settings.hasAppPassword && (
              <div className={styles.savedMetaRow}>
                <span className={styles.savedPill}>
                  <ShieldCheckIcon className={styles.iconSm} aria-hidden />
                  App Password securely saved
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setClearDialogOpen(true)}
                  className={styles.clearPwdBtn}
                >
                  Remove saved password
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.fieldsGrid}>
          <TextField
            label="Sender display name"
            fieldSize="md"
            maxLength={80}
            placeholder={shopName}
            hint={`Optional. Shown as the sender name in customer inboxes (defaults to "${shopName}").`}
            disabled={!settings.migrationReady || busy}
            error={errors.senderName?.message}
            {...form.register("senderName")}
          />
          <TextField
            label="Reply-To email"
            kind="email"
            type="email"
            fieldSize="md"
            placeholder="support@yourshop.com"
            hint="Optional. Customer replies go here (defaults to your Gmail address)."
            disabled={!settings.migrationReady || busy}
            error={errors.replyTo?.message}
            {...form.register("replyTo")}
          />
        </div>

        <details className={styles.guideDetails}>
          <summary className={styles.guideSummary}>
            <HelpCircleIcon className={styles.guideIcon} aria-hidden />
            How to generate a 16-character Gmail App Password
          </summary>
          <ol className={styles.guideSteps}>
            <li>
              Open your Google Account security settings and ensure <strong>2-Step Verification</strong> is turned on.
            </li>
            <li>
              Go to{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.guideLink}
              >
                myaccount.google.com/apppasswords
              </a>{" "}
              and sign in with the Gmail address above.
            </li>
            <li>
              Enter an app name (e.g. <strong>{shopName} Store</strong>) and click <strong>Create</strong>.
            </li>
            <li>
              Copy the 16-character password Google shows, paste it above, save settings, and click <strong>Send test email</strong> below.
            </li>
          </ol>
        </details>

        <div className={styles.actionRow}>
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => form.reset(toFormDefaults(settings))}
              className={styles.secondaryBtn}
            >
              Discard
            </Button>
          )}
          <Button
            type="submit"
            disabled={!settings.migrationReady || !isDirty || busy}
            className={styles.primaryBtn}
          >
            {saving ? <Loader2Icon className={styles.spinIcon} /> : <SaveIcon className={styles.icon16} aria-hidden />}
            Save email settings
          </Button>
        </div>
      </form>

      <div className={styles.testPanel}>
        <div className={styles.testHeader}>
          <h3 className={styles.testTitle}>Send a test email</h3>
          {settings.lastTestStatus === "ok" && (
            <span className={styles.testStatusOk}>
              <CheckCircle2Icon className={styles.icon16} aria-hidden />
              Last test succeeded{testedLabel ? ` · ${testedLabel}` : ""}
            </span>
          )}
          {settings.lastTestStatus === "error" && (
            <span className={styles.testStatusErr}>
              <XCircleIcon className={styles.icon16} aria-hidden />
              Last test failed{testedLabel ? ` · ${testedLabel}` : ""}
            </span>
          )}
        </div>
        <div className={styles.testRow}>
          <div className={styles.testInputWrap}>
            <TextField
              label="Test recipient email"
              kind="email"
              type="email"
              fieldSize="md"
              noErrorSpace
              placeholder="you@gmail.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              disabled={!settings.migrationReady || busy}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!settings.migrationReady || busy}
            onClick={onSendTest}
            className={styles.testBtn}
          >
            {testing ? <Loader2Icon className={styles.spinIcon} /> : <SendIcon className={styles.icon16} aria-hidden />}
            Send test email
          </Button>
        </div>
        {settings.lastTestStatus === "error" && settings.lastTestError && (
          <p role="alert" className={styles.testErrorBox}>
            {settings.lastTestError}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Remove saved Gmail App Password?"
        description="This deletes the encrypted App Password and turns off Gmail SMTP until you enter a new one. Password resets will fall back to Supabase's default sender."
        confirmLabel="Remove password"
        destructive
        pending={clearing}
        onConfirm={onConfirmClearPassword}
      />
    </section>
  )
}
