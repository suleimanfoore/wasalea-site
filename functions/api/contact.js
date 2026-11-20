/**
 * POST /api/contact — emails a contact-form submission.
 *
 * Cloudflare Pages Function. Runs on Cloudflare's edge; no server to keep up.
 *
 * Environment variables (set in the Cloudflare dashboard, NOT in this repo:
 *   Workers & Pages -> wasalea-site -> Settings -> Variables and secrets):
 *
 *   RESEND_API_KEY   secret.  API key from resend.com.
 *   CONTACT_TO       plain.   Where enquiries are sent, e.g. you@example.com.
 *   CONTACT_FROM     plain.   Sender on a domain verified in Resend,
 *                             e.g. "Wasalea site <site@wasalea.com>".
 *
 * With RESEND_API_KEY or CONTACT_TO missing the endpoint answers 503 and the
 * form tells the visitor to try again later, rather than pretending it sent.
 */

const MAX = { name: 100, business: 120, phone: 40, email: 160, message: 2000 };

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

const clean = (value, limit) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Could not read that submission.' }, 400);
  }

  // Honeypot: a real visitor never sees this field, so anything in it is a bot.
  // Answer 200 so the bot has nothing to learn, and send no mail.
  if (clean(input.website, 200)) return json({ ok: true }, 200);

  const data = {
    name: clean(input.name, MAX.name),
    business: clean(input.business, MAX.business),
    phone: clean(input.phone, MAX.phone),
    email: clean(input.email, MAX.email),
    // Keep the visitor's line breaks in the message; only trim and cap it.
    message: typeof input.message === 'string' ? input.message.trim().slice(0, MAX.message) : ''
  };

  if (!data.name || !data.phone || !data.message) {
    return json({ error: 'Please fill in your name, a phone number, and a message.' }, 400);
  }
  if (data.email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(data.email)) {
    return json({ error: 'That email address does not look right.' }, 400);
  }

  const to = env.CONTACT_TO;
  const key = env.RESEND_API_KEY;
  if (!key || !to) {
    return json(
      { error: 'The contact form is not configured yet. Please try again later.' },
      503
    );
  }

  const country = request.headers.get('cf-ipcountry') || 'unknown';
  const lines = [
    `Name:     ${data.name}`,
    `Business: ${data.business || '-'}`,
    `Phone:    ${data.phone}`,
    `Email:    ${data.email || '-'}`,
    `Country:  ${country}`,
    '',
    data.message
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM || 'Wasalea site <onboarding@resend.dev>',
      to: [to],
      // Replies go straight to the enquirer when they left an address.
      ...(data.email ? { reply_to: data.email } : {}),
      subject: `wasalea.com enquiry - ${data.name}${data.business ? ` (${data.business})` : ''}`,
      text: lines.join('\n')
    })
  });

  if (!res.ok) {
    // Keep the provider's reason in the Pages function log, not in the response.
    console.error('resend failed', res.status, await res.text().catch(() => ''));
    return json({ error: 'Sorry, that did not send. Please try again in a moment.' }, 502);
  }

  return json({ ok: true }, 200);
}

export const onRequestGet = () =>
  json({ error: 'Send this form with POST.' }, 405);
