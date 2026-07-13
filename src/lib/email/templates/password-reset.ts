// Password-reset email template. Templates are pure functions that take their
// data and return { subject, html, text } — no side effects, no Resend import —
// so they are trivially unit-testable and reusable. Phase I adds order emails as
// sibling files (order-confirmed.ts, shipped.ts, …) in this folder.

export interface PasswordResetEmailInput {
  resetUrl: string;
  name?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function passwordResetEmail({
  resetUrl,
  name,
}: PasswordResetEmailInput): EmailContent {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const subject = "Reset your Xarvisrobo password";

  // Plain-text fallback for clients that don't render HTML.
  const text = [
    greeting,
    "",
    "We received a request to reset your Xarvisrobo password.",
    "Open the link below to choose a new password. This link expires in 24 hours",
    "and can only be used once.",
    "",
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email — your",
    "password won't change.",
    "",
    "— Xarvisrobo",
  ].join("\n");

  // Light, minimal, on-brand. Inlined styles because email clients strip
  // <style> and external CSS. Neutral palette matching the site header.
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#171717;">Xarvisrobo</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#171717;">Reset your password</h1>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#525252;">${greeting}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#525252;">
                  We received a request to reset your Xarvisrobo password. Click the button below to choose a new one.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:9999px;background-color:#171717;">
                      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:9999px;">Reset password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#737373;">
                  This link expires in 24 hours and can only be used once. If the button doesn't work, copy and paste this link into your browser:<br />
                  <a href="${resetUrl}" style="color:#525252;word-break:break-all;">${resetUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid #f0f0f0;">
                <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a3a3a3;">
                  If you didn't request this, you can safely ignore this email — your password won't change.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
