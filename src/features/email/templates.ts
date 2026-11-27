/**
 * Table-based, inline-CSS HTML + plain-text email templates.
 * Compatible with Gmail, Outlook, Apple Mail, and mobile mail clients
 * (no Flexbox, no CSS Grid, explicit table attributes, web-safe fonts).
 */

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function wrapEmailLayout({
  shopName,
  preheader,
  badgeText,
  heading,
  bodyRowsHtml,
  footerNote,
}: {
  shopName: string
  preheader: string
  badgeText: string
  heading: string
  bodyRowsHtml: string
  footerNote: string
}): string {
  const safeShop = escapeHtml(shopName)
  const safePreheader = escapeHtml(preheader)
  const safeBadge = escapeHtml(badgeText)
  const safeHeading = escapeHtml(heading)
  const safeFooter = escapeHtml(footerNote)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeHeading} - ${safeShop}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f3ef; font-family: Arial, Helvetica, sans-serif; color: #1f1a17; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: #f6f3ef;">
    ${safePreheader}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f6f3ef; width: 100%;">
    <tr>
      <td align="center" style="padding: 28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e7dfd5; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #2b211b; padding: 22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 26px; font-weight: bold; color: #ffffff; letter-spacing: 0.3px;">
                    ${safeShop}
                  </td>
                  <td align="right" style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 16px; font-weight: bold; color: #f4d9b5; text-transform: uppercase; letter-spacing: 0.8px;">
                    ${safeBadge}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 28px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; line-height: 30px; font-weight: bold; color: #1f1a17; padding-bottom: 14px;">
                    ${safeHeading}
                  </td>
                </tr>
                ${bodyRowsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #faf7f3; border-top: 1px solid #ece5dc; padding: 18px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px; color: #6e6259;">
                    ${safeFooter}
                  </td>
                </tr>
                <tr>
                  <td style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 16px; color: #8c7f75; padding-top: 6px;">
                    Sent securely by ${safeShop}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildPasswordResetEmail({
  shopName,
  recipientName,
  resetUrl,
  scope,
  expiresMinutes = 30,
}: {
  shopName: string
  recipientName?: string | null
  resetUrl: string
  scope: "customer" | "admin"
  expiresMinutes?: number
}): { subject: string; html: string; text: string } {
  const greetingName = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,"
  const isAdmin = scope === "admin"
  const subject = isAdmin
    ? `Reset your ${shopName} admin password`
    : `Reset your ${shopName} password`
  const badgeText = isAdmin ? "Admin Security" : "Account Recovery"
  const heading = isAdmin ? "Reset your admin password" : "Reset your password"
  const intro = isAdmin
    ? `We received a request to reset the password for your ${shopName} admin workspace.`
    : `We received a request to reset the password for your ${shopName} account.`

  const safeGreeting = escapeHtml(greetingName)
  const safeIntro = escapeHtml(intro)
  const safeUrl = escapeHtml(resetUrl)

  const bodyRowsHtml = `
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 12px;">
        ${safeGreeting}
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 22px;">
        ${safeIntro} Click the button below to choose a new password.
      </td>
    </tr>
    <tr>
      <td align="left" style="padding-bottom: 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: #b4532a; border-radius: 8px;">
              <a href="${safeUrl}" target="_blank" style="display: inline-block; padding: 13px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 20px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
                Reset password
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #faf7f3; border: 1px solid #ece5dc; border-radius: 8px; padding: 14px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #5c5149;">
        <strong>One-time link:</strong> This link expires in ${expiresMinutes} minutes and can only be used once.
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px; color: #73675e; padding-top: 18px;">
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </td>
    </tr>
    <tr>
      <td style="font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 18px; color: #b4532a; word-break: break-all; padding-top: 6px;">
        <a href="${safeUrl}" target="_blank" style="color: #b4532a; text-decoration: underline;">${safeUrl}</a>
      </td>
    </tr>`

  const html = wrapEmailLayout({
    shopName,
    preheader: `Use this one-time link to reset your ${shopName} password (expires in ${expiresMinutes} minutes).`,
    badgeText,
    heading,
    bodyRowsHtml,
    footerNote: "Didn't request a password reset? You can safely ignore this email — your password will stay unchanged.",
  })

  const text = [
    `${greetingName}`,
    "",
    intro,
    "",
    `Reset your password here (expires in ${expiresMinutes} minutes, single use):`,
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
    `— ${shopName}`,
  ].join("\n")

  return { subject, html, text }
}

export function buildPasswordChangedEmail({
  shopName,
  recipientName,
  scope,
  loginUrl,
}: {
  shopName: string
  recipientName?: string | null
  scope: "customer" | "admin"
  loginUrl: string
}): { subject: string; html: string; text: string } {
  const greetingName = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,"
  const isAdmin = scope === "admin"
  const subject = isAdmin
    ? `Your ${shopName} admin password was changed`
    : `Your ${shopName} password was updated`
  const badgeText = isAdmin ? "Admin Security" : "Security Alert"
  const heading = isAdmin ? "Admin password updated" : "Password updated"
  const summary = isAdmin
    ? `Your ${shopName} admin password was just changed via the password reset link.`
    : `Your ${shopName} account password was just updated. You can now sign in with your new password.`

  const safeGreeting = escapeHtml(greetingName)
  const safeSummary = escapeHtml(summary)
  const safeLoginUrl = escapeHtml(loginUrl)

  const bodyRowsHtml = `
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 12px;">
        ${safeGreeting}
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 20px;">
        ${safeSummary}
      </td>
    </tr>
    <tr>
      <td align="left" style="padding-bottom: 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: #2b211b; border-radius: 8px;">
              <a href="${safeLoginUrl}" target="_blank" style="display: inline-block; padding: 12px 22px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 18px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
                Open ${escapeHtml(shopName)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const html = wrapEmailLayout({
    shopName,
    preheader: `Your ${shopName} password was just updated.`,
    badgeText,
    heading,
    bodyRowsHtml,
    footerNote: "If you did not make this change, reset your password immediately and review your account security.",
  })

  const text = [
    greetingName,
    "",
    summary,
    "",
    `Sign in: ${loginUrl}`,
    "",
    "If you did not make this change, reset your password immediately.",
    `— ${shopName}`,
  ].join("\n")

  return { subject, html, text }
}

export function buildTestEmail({
  shopName,
  senderEmail,
  recipientEmail,
  testedAt,
}: {
  shopName: string
  senderEmail: string
  recipientEmail: string
  testedAt: string
}): { subject: string; html: string; text: string } {
  const subject = `${shopName} — Gmail SMTP test email`
  const safeSender = escapeHtml(senderEmail)
  const safeRecipient = escapeHtml(recipientEmail)
  const safeTime = escapeHtml(testedAt)

  const bodyRowsHtml = `
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 16px;">
        Your Gmail App Password SMTP connection is working! Password reset emails and store notifications will be delivered using this configuration.
      </td>
    </tr>
    <tr>
      <td style="background-color: #faf7f3; border: 1px solid #ece5dc; border-radius: 8px; padding: 14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #6e6259; padding-bottom: 6px; width: 120px;">
              Sender Gmail
            </td>
            <td style="font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 20px; color: #1f1a17; font-weight: bold; padding-bottom: 6px;">
              ${safeSender}
            </td>
          </tr>
          <tr>
            <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #6e6259; padding-bottom: 6px;">
              Sent to
            </td>
            <td style="font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 20px; color: #1f1a17; padding-bottom: 6px;">
              ${safeRecipient}
            </td>
          </tr>
          <tr>
            <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #6e6259;">
              Tested at
            </td>
            <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #1f1a17;">
              ${safeTime}
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const html = wrapEmailLayout({
    shopName,
    preheader: `Gmail SMTP test email from ${shopName} succeeded.`,
    badgeText: "SMTP Test",
    heading: "Gmail SMTP is connected",
    bodyRowsHtml,
    footerNote: "This test email was triggered from Admin → Settings → Email & Gmail SMTP.",
  })

  const text = [
    `${shopName} — Gmail SMTP is connected!`,
    "",
    "Your Gmail App Password SMTP connection is working.",
    `Sender Gmail: ${senderEmail}`,
    `Sent to: ${recipientEmail}`,
    `Tested at: ${testedAt}`,
  ].join("\n")

  return { subject, html, text }
}

export function buildWelcomeEmail({
  shopName,
  recipientName,
  shopUrl,
}: {
  shopName: string
  recipientName?: string | null
  shopUrl: string
}): { subject: string; html: string; text: string } {
  const greetingName = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,"
  const subject = `Welcome to ${shopName}!`
  const safeGreeting = escapeHtml(greetingName)
  const safeShop = escapeHtml(shopName)
  const safeShopUrl = escapeHtml(shopUrl)

  const bodyRowsHtml = `
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 12px;">
        ${safeGreeting}
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 20px;">
        Your ${safeShop} account is ready. You can now track orders, save delivery addresses, and sync your wishlist across devices.
      </td>
    </tr>
    <tr>
      <td align="left" style="padding-bottom: 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: #b4532a; border-radius: 8px;">
              <a href="${safeShopUrl}" target="_blank" style="display: inline-block; padding: 13px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 20px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
                Start shopping
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const html = wrapEmailLayout({
    shopName,
    preheader: `Welcome to ${shopName}! Your account is all set.`,
    badgeText: "Welcome",
    heading: `Welcome to ${shopName}`,
    bodyRowsHtml,
    footerNote: `You received this email because you created an account on ${shopName}.`,
  })

  const text = [
    greetingName,
    "",
    `Welcome to ${shopName}! Your account is ready.`,
    `Visit the store: ${shopUrl}`,
    "",
    `— ${shopName}`,
  ].join("\n")

  return { subject, html, text }
}

export function buildSignupVerifyEmail({
  shopName,
  recipientName,
  verifyUrl,
  expiresHours = 24,
}: {
  shopName: string
  recipientName?: string | null
  verifyUrl: string
  expiresHours?: number
}): { subject: string; html: string; text: string } {
  const greetingName = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,"
  const subject = `Verify your ${shopName} email address`
  const safeGreeting = escapeHtml(greetingName)
  const safeShop = escapeHtml(shopName)
  const safeVerifyUrl = escapeHtml(verifyUrl)

  const bodyRowsHtml = `
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 12px;">
        ${safeGreeting}
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #362e29; padding-bottom: 22px;">
        Thanks for signing up with ${safeShop}! Confirm your email address below to activate your account and sign in.
      </td>
    </tr>
    <tr>
      <td align="left" style="padding-bottom: 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: #b4532a; border-radius: 8px;">
              <a href="${safeVerifyUrl}" target="_blank" style="display: inline-block; padding: 13px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 20px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
                Verify email address
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #faf7f3; border: 1px solid #ece5dc; border-radius: 8px; padding: 14px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #5c5149;">
        <strong>One-time link:</strong> This verification link expires in ${expiresHours} hours.
      </td>
    </tr>
    <tr>
      <td style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px; color: #73675e; padding-top: 18px;">
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </td>
    </tr>
    <tr>
      <td style="font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 18px; color: #b4532a; word-break: break-all; padding-top: 6px;">
        <a href="${safeVerifyUrl}" target="_blank" style="color: #b4532a; text-decoration: underline;">${safeVerifyUrl}</a>
      </td>
    </tr>`

  const html = wrapEmailLayout({
    shopName,
    preheader: `Confirm your email address to finish creating your ${shopName} account.`,
    badgeText: "Verify Email",
    heading: "Confirm your email address",
    bodyRowsHtml,
    footerNote: "If you didn't create an account, you can safely ignore this email.",
  })

  const text = [
    greetingName,
    "",
    `Thanks for signing up with ${shopName}!`,
    `Verify your email here (expires in ${expiresHours} hours):`,
    verifyUrl,
    "",
    "If you didn't create an account, you can safely ignore this email.",
    `— ${shopName}`,
  ].join("\n")

  return { subject, html, text }
}
