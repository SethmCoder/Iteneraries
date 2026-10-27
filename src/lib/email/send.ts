import { Resend } from "resend";
import {
  getAppUrl,
  getResendApiKey,
  getResendFromEmail,
  isOutboundEmailConfigured,
} from "@/lib/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isOutboundEmailConfigured()) {
    return {
      ok: false,
      error: "Outbound email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
    };
  }

  const apiKey = getResendApiKey()!;
  const from = getResendFromEmail()!;
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function appLink(path: string): string {
  return `${getAppUrl().replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function wrapEmail(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.href}" style="background:#1616C9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  return {
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F7F8FC;padding:24px;color:#1F2937">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:24px">
    <div style="height:4px;background:#1616C9;border-radius:4px;margin:-24px -24px 20px"></div>
    <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
    <div style="font-size:14px;line-height:1.5;color:#6B7280">${bodyHtml}</div>
    ${button}
    <p style="font-size:12px;color:#9CA3AF;margin-top:28px">Waypoint · travel planning</p>
  </div></body></html>`,
    text: `${title}\n\n${bodyHtml.replace(/<[^>]+>/g, "")}${cta ? `\n\n${cta.label}: ${cta.href}` : ""}`,
  };
}
