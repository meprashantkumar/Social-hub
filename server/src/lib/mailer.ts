import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | null = null;

/** True only when the SMTP host + credentials are all present. */
export function isEmailConfigured(): boolean {
  return Boolean(env.EMAIL_SERVER_HOST && env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: env.EMAIL_SERVER_PORT,
      secure: env.EMAIL_SERVER_PORT === 465, // implicit TLS on 465, STARTTLS otherwise
      auth: { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD },
    });
  }
  return transporter;
}

const fromHeader = (): string => env.EMAIL_FROM || `SocialHub <${env.EMAIL_SERVER_USER}>`;

/** Send the password-reset email containing a one-time reset link. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your SocialHub password";
  const text = [
    "You requested a password reset for your SocialHub account.",
    "",
    `Reset your password: ${resetUrl}`,
    "",
    "This link expires in 30 minutes and can be used once. If you didn't request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
  <div style="margin:0;padding:24px;background:#f4f4f6;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="font-size:20px;font-weight:700;color:#18181b;">
              Social<span style="color:#7c3aed;">Hub</span>
            </div>
          </td></tr>
          <tr><td style="padding:8px 32px 0;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">Reset your password</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#52525b;">
              We received a request to reset the password for your SocialHub account.
              Click the button below to choose a new one.
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">
              Reset password
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#71717a;">
              This link expires in 30 minutes and can be used once. If you didn't request a
              password reset, you can safely ignore this email — your password won't change.
            </p>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;word-break:break-all;">
              Or paste this URL into your browser:<br />${resetUrl}
            </p>
          </td></tr>
          <tr><td style="padding:24px 32px 32px;">
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px;" />
            <p style="margin:0;font-size:12px;color:#a1a1aa;">© SocialHub</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;

  await getTransporter().sendMail({ from: fromHeader(), to, subject, text, html });
}
