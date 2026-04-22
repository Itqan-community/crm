import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { validateField } from '@/lib/validation';
import { sendSlackNewSubmission } from '@/lib/notify/slack';
import { sendSubmitterConfirmation } from '@/lib/notify/email';
import { subscribeToNewsletter } from '@/lib/notify/newsletter';
import type { Bilingual, FormFieldRow, Lang, SemanticRole } from '@/types/database';
import { pick } from '@/lib/i18n';

type IncomingAnswer = {
  field_id: string;
  field_key: string;
  field_label: Bilingual;
  value: string | string[] | null;
  semantic_role: SemanticRole | null;
};

type IncomingPayload = {
  category_id: string;
  language: Lang;
  answers: IncomingAnswer[];
};

export async function POST(req: Request) {
  let payload: IncomingPayload;
  try {
    payload = (await req.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!payload?.category_id || !Array.isArray(payload.answers)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const lang: Lang = payload.language === 'en' ? 'en' : 'ar';
  const supabase = createSupabaseAdminClient();

  // Re-fetch fields server-side and validate against canonical schema
  // (never trust client-provided labels/required flags).
  const { data: fields, error: fieldsErr } = await supabase
    .from('form_fields')
    .select('*')
    .eq('category_id', payload.category_id)
    .eq('is_active', true);

  if (fieldsErr) {
    console.error('[api/submissions] fields fetch failed', fieldsErr);
    return NextResponse.json({ error: 'schema_unavailable' }, { status: 500 });
  }
  const fieldsTyped = (fields || []) as FormFieldRow[];
  if (fieldsTyped.length === 0) {
    return NextResponse.json({ error: 'unknown_category' }, { status: 400 });
  }

  // Build a map by id for the answers we received
  const answerById = new Map(payload.answers.map((a) => [a.field_id, a]));

  // Validate each canonical field
  for (const f of fieldsTyped) {
    const a = answerById.get(f.id);
    const v = a?.value ?? null;
    const err = validateField(f, v as string | string[] | undefined, lang);
    if (err) {
      return NextResponse.json({ error: 'validation_failed', field: f.key, detail: err }, { status: 422 });
    }
  }

  // Extract semantic fields
  const findBySemantic = (role: SemanticRole) => fieldsTyped.find((f) => f.semantic_role === role);
  const nameField = findBySemantic('name');
  const emailField = findBySemantic('email');
  const newsletterField = findBySemantic('newsletter');

  if (!nameField || !emailField) {
    return NextResponse.json({ error: 'category_missing_identity_fields' }, { status: 500 });
  }

  const nameVal = (answerById.get(nameField.id)?.value ?? '') as string;
  const emailVal = (answerById.get(emailField.id)?.value ?? '') as string;

  let newsletterOptin = false;
  if (newsletterField) {
    const v = answerById.get(newsletterField.id)?.value;
    newsletterOptin = Array.isArray(v) ? v.length > 0 : Boolean(v);
  }

  // Insert submission
  const { data: submissionRows, error: subErr } = await supabase
    .from('submissions')
    .insert({
      category_id: payload.category_id,
      language: lang,
      submitter_name: String(nameVal).trim(),
      submitter_email: String(emailVal).trim().toLowerCase(),
      newsletter_optin: newsletterOptin,
    })
    .select('id, reference_no, category_id')
    .single();

  if (subErr || !submissionRows) {
    console.error('[api/submissions] insert failed', subErr);
    return NextResponse.json({ error: 'submission_insert_failed' }, { status: 500 });
  }

  // Insert answers (skip empty)
  const answerRows = fieldsTyped
    .map((f) => {
      const a = answerById.get(f.id);
      const v = a?.value ?? null;
      const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (isEmpty) return null;
      return {
        submission_id: submissionRows.id,
        field_id: f.id,
        field_key_snap: f.key,
        field_label_snap: { ar: f.label_ar, en: f.label_en },
        value_text: typeof v === 'string' ? v : null,
        value_json: Array.isArray(v) ? v : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  // Insert answers and fetch the category label in parallel — both depend
  // only on values we already have, so there's no need to serialize them.
  const [answerInsert, catLookup] = await Promise.all([
    answerRows.length > 0
      ? supabase.from('submission_answers').insert(answerRows)
      : Promise.resolve({ error: null }),
    supabase
      .from('form_categories')
      .select('label_ar, label_en')
      .eq('id', payload.category_id)
      .single(),
  ]);

  if (answerInsert.error) {
    console.error('[api/submissions] answers insert failed', answerInsert.error);
    // Best-effort cleanup of orphan submission
    await supabase.from('submissions').delete().eq('id', submissionRows.id);
    return NextResponse.json({ error: 'answers_insert_failed' }, { status: 500 });
  }

  const categoryLabel = pick(
    { ar: catLookup.data?.label_ar ?? '', en: catLookup.data?.label_en ?? '' },
    lang,
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const submissionUrl = `${siteUrl}/admin/submissions/${submissionRows.id}`;

  // Fire-and-forget notifications. If any fail, log to activity_log so the team sees it.
  const [slackOk, emailOk, newsletterOk] = await Promise.all([
    sendSlackNewSubmission({
      referenceNo: submissionRows.reference_no,
      categoryLabel,
      submitterName: String(nameVal),
      submitterEmail: String(emailVal),
      submissionUrl,
    }),
    sendSubmitterConfirmation({
      to: String(emailVal),
      name: String(nameVal),
      referenceNo: submissionRows.reference_no,
      lang,
    }),
    newsletterOptin
      ? subscribeToNewsletter({ name: String(nameVal), email: String(emailVal) })
      : Promise.resolve(true),
  ]);

  const logs: { action: string; meta?: Record<string, unknown> }[] = [];
  if (process.env.SLACK_WEBHOOK_URL && !slackOk) logs.push({ action: 'slack_failed' });
  if (process.env.RESEND_API_KEY && !emailOk) logs.push({ action: 'email_failed' });
  if (newsletterOptin) {
    logs.push(newsletterOk ? { action: 'newsletter_subscribed' } : { action: 'newsletter_failed' });
  }
  if (logs.length > 0) {
    await supabase.from('activity_log').insert(
      logs.map((l) => ({
        submission_id: submissionRows.id,
        action: l.action,
        meta: l.meta || {},
      })),
    );
  }

  return NextResponse.json({
    id: submissionRows.id,
    reference_no: submissionRows.reference_no,
  });
}
