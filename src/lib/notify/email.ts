import { Resend } from 'resend';
import type { Lang } from '@/types/database';

// Brand identity — same across all environments, lives with the code.
const FROM_EMAIL = 'connect@itqan.dev';
const FROM_NAME_AR = 'مجتمع إتقان';
const FROM_NAME_EN = 'Itqan Community';

type ConfirmationPayload = {
  to: string;
  name: string;
  referenceNo: string;
  lang: Lang;
};

export async function sendSubmitterConfirmation(p: ConfirmationPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const fromName = p.lang === 'ar' ? FROM_NAME_AR : FROM_NAME_EN;
  const from = `${fromName} <${FROM_EMAIL}>`;

  const subject =
    p.lang === 'ar'
      ? `وصلتنا رسالتك · رقم مرجعي ${p.referenceNo}`
      : `We received your message · Ref ${p.referenceNo}`;

  const html =
    p.lang === 'ar'
      ? renderAr(p.name, p.referenceNo)
      : renderEn(p.name, p.referenceNo);

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({ from, to: p.to, subject, html });
    return !result.error;
  } catch (err) {
    console.error('[resend] send failed', err);
    return false;
  }
}

function renderAr(name: string, ref: string): string {
  // direction:rtl + text-align:right are repeated inline because Gmail and
  // Outlook strip the <html dir="rtl"> attribute when they wrap the body in
  // their own container, leaving Arabic punctuation in the wrong visual slot.
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><body style="font-family: Tahoma, Arial, sans-serif; background:#FAF6F0; margin:0; padding:32px; direction:rtl; text-align:right;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#fff; border:1px solid rgba(27,67,50,0.12); border-radius:14px; overflow:hidden;">
      <tr><td style="padding:28px; direction:rtl; text-align:right;">
        <h1 style="margin:0 0 12px; font-size:22px; color:#1F2A24;">مرحباً ${escapeHtml(name)}،</h1>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.85; color:#1F2A24;">
          وصلتنا رسالتك بحمد الله. سيراجعها فريق إتقان ويعود إليك خلال ٣ أيام عمل بإذن الله.
        </p>
        <div style="margin:18px 0; padding:14px 18px; border:1px solid rgba(27,67,50,0.12); border-radius:10px; background:#F1EFE7;">
          <div style="font-size:12px; color:#6B6B68; margin-bottom:4px;">الرقم المرجعي</div>
          <div style="font-size:17px; font-weight:600; color:#1B4332; font-family:monospace; direction:ltr; unicode-bidi:isolate;">${escapeHtml(ref)}</div>
        </div>
        <p style="margin:0; font-size:13.5px; color:#6B6B68;">إن احتجت للتواصل قبل ذلك، راسلنا على
          <a href="mailto:connect@itqan.dev" style="color:#1B4332;">connect@itqan.dev</a> مع ذكر الرقم المرجعي.</p>
      </td></tr>
    </table>
  </body></html>`;
}

function renderEn(name: string, ref: string): string {
  return `<!DOCTYPE html><html lang="en"><body style="font-family: Helvetica, Arial, sans-serif; background:#FAF6F0; margin:0; padding:32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#fff; border:1px solid rgba(27,67,50,0.12); border-radius:14px; overflow:hidden;">
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px; font-size:22px; color:#1F2A24;">Hi ${escapeHtml(name)},</h1>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#1F2A24;">
          We've received your message. The Itqan team will review it and get back to you within 3 business days.
        </p>
        <div style="margin:18px 0; padding:14px 18px; border:1px solid rgba(27,67,50,0.12); border-radius:10px; background:#F1EFE7;">
          <div style="font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:#6B6B68; margin-bottom:4px;">Reference number</div>
          <div style="font-size:17px; font-weight:600; color:#1B4332; font-family:monospace;">${escapeHtml(ref)}</div>
        </div>
        <p style="margin:0; font-size:13.5px; color:#6B6B68;">For any follow-up, reach us at
          <a href="mailto:connect@itqan.dev" style="color:#1B4332;">connect@itqan.dev</a> and mention the reference number.</p>
      </td></tr>
    </table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
