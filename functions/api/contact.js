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

const MAX = {
  enquiry: 60, name: 100, business: 120, country: 60,
  phone: 40, email: 160, agents: 30, method: 40, message: 2000
};

// The form offers fixed choices for these. Anything else was not typed by a
// visitor using the page, so it is recorded as-is but flagged rather than
// trusted - a reader of the email should be able to tell the difference.
const ENQUIRY_CHOICES = [
  'Product demonstration', 'Personalised quote', 'Android tablet companion',
  'Technical support', 'Something else'
];
const AGENT_CHOICES = ['1 to 5', '6 to 20', '21 to 50', 'More than 50'];
const METHOD_CHOICES = [
  'Excel or Google Sheets', 'Paper records',
  'Another software package', 'Nothing formal yet'
];

const known = (value, choices) =>
  !value ? '-' : choices.includes(value) ? value : `${value} (not a listed option)`;

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
    enquiry: clean(input.enquiry, MAX.enquiry),
    name: clean(input.name, MAX.name),
    business: clean(input.business, MAX.business),
    country: clean(input.country, MAX.country),
    phone: clean(input.phone, MAX.phone),
    email: clean(input.email, MAX.email),
    agents: clean(input.agents, MAX.agents),
    method: clean(input.method, MAX.method),
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

  // Where Cloudflare saw the request come from, which is not the same thing as
  // the country the visitor typed. Both are shown, so a mismatch is visible.
  const seenFrom = request.headers.get('cf-ipcountry') || 'unknown';

  const lines = [
    `About:        ${known(data.enquiry, ENQUIRY_CHOICES)}`,
    '',
    `Name:         ${data.name}`,
    `Business:     ${data.business || '-'}`,
    `Phone:        ${data.phone}`,
    `Email:        ${data.email || '-'}`,
    `Country:      ${data.country || '-'}`,
    '',
    `Agents:       ${known(data.agents, AGENT_CHOICES)}`,
    `Tracks float: ${known(data.method, METHOD_CHOICES)}`,
    '',
    data.message,
    '',
    '--',
    `Sent from the wasalea.com contact form. Request seen from: ${seenFrom}.`
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
      subject: `${data.enquiry || 'Enquiry'} - ${data.name}${data.business ? ` (${data.business})` : ''}`,
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
