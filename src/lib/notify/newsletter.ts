// Phase 1: proxy to Itqan's existing newsletter endpoint (which wraps MailerLite).
// Phase 2: switch to direct MailerLite API by setting MAILERLITE_API_KEY.

type NewsletterPayload = { name: string; email: string };

export async function subscribeToNewsletter(p: NewsletterPayload): Promise<boolean> {
  if (process.env.MAILERLITE_API_KEY) {
    return subscribeViaMailerlite(p);
  }
  return subscribeViaProxy(p);
}

async function subscribeViaProxy(p: NewsletterPayload): Promise<boolean> {
  const url = process.env.NEWSLETTER_PROXY_URL || 'https://itqan.dev/api/newsletter/subscribe/';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    });
    return res.ok;
  } catch (err) {
    console.error('[newsletter] proxy failed', err);
    return false;
  }
}

async function subscribeViaMailerlite(p: NewsletterPayload): Promise<boolean> {
  const apiKey = process.env.MAILERLITE_API_KEY!;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  const body: Record<string, unknown> = {
    email: p.email,
    fields: { name: p.name },
  };
  if (groupId) body.groups = [groupId];
  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error('[newsletter] mailerlite failed', err);
    return false;
  }
}
