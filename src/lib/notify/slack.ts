type SlackPayload = {
  referenceNo: string;
  categoryLabel: string;
  submitterName: string;
  submitterEmail: string;
  submissionUrl: string;
};

export async function sendSlackNewSubmission(payload: SlackPayload): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  const body = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `طلب جديد · ${payload.categoryLabel}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*الاسم:*\n${payload.submitterName}` },
          { type: 'mrkdwn', text: `*البريد:*\n${payload.submitterEmail}` },
          { type: 'mrkdwn', text: `*الرقم المرجعي:*\n\`${payload.referenceNo}\`` },
          { type: 'mrkdwn', text: `*الفئة:*\n${payload.categoryLabel}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'فتح في اللوحة' },
            url: payload.submissionUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error('[slack] webhook failed', err);
    return false;
  }
}
