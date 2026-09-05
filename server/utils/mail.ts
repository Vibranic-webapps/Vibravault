/**
 * Email sending via Resend.
 *
 * Degrades deliberately: with no RESEND_API_KEY set, it logs the message
 * instead of throwing. That means the whole password-reset flow is testable
 * locally, and a missing key in production can never turn "forgot password"
 * into a 500 - the user still gets the same neutral response either way.
 */
interface SendArgs {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendMail({ to, subject, html, text }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? 'Vibravault <noreply@kilianfrederix.net>'

  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY not set - logging instead of sending')
    console.warn(`[mail] to=${to} subject=${subject}\n${text}`)
    return
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { from, to, subject, html, text },
    })
  } catch (e) {
    // Never surface a mail failure to the caller: /api/auth/forgot-password
    // must answer identically whether or not the address exists, and whether
    // or not the provider is having a bad day.
    console.error('[mail] send failed', e)
  }
}

export function resetEmail(link: string) {
  const text = `Reset your Vibravault password:\n\n${link}\n\n`
    + `This link works once and expires in 1 hour.\n`
    + `If you did not ask for this, ignore this email - nothing has changed.`

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
              background:#F7F5F1;padding:32px;color:#2C2C2A">
    <div style="max-width:460px;margin:0 auto;background:#F7F5F1;border-radius:28px;padding:32px;
                box-shadow:-12px -12px 24px #FFFFFF,12px 12px 24px #DBD6CD">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.14em;
                text-transform:uppercase;color:#3C3489">Vibravault</p>
      <h1 style="margin:0 0 12px;font-size:22px">Reset your password</h1>
      <p style="margin:0 0 22px;font-size:15px;color:#5F5E5A">
        Click below to choose a new password. The link works once and expires in 1 hour.
      </p>
      <a href="${link}"
         style="display:inline-block;padding:13px 22px;background:#0F6E56;color:#fff;
                font-weight:600;font-size:15px;text-decoration:none;border-radius:14px">
        Choose a new password
      </a>
      <p style="margin:22px 0 0;font-size:13px;color:#888780">
        If you did not ask for this, ignore this email &mdash; nothing has changed.
      </p>
    </div>
  </div>`

  return { subject: 'Reset your Vibravault password', text, html }
}
