/**
 * GET /get?p=windows|mac|guide
 *
 * The download gate. Signed in, you get the file. Not signed in, you get a
 * page offering Google, Facebook and LinkedIn.
 *
 * Fails open: if no provider is configured the visitor is sent straight to
 * the file. The installer is on a public bucket either way, and a download
 * button that leads nowhere would cost a real sale to save nothing.
 */

import { FILES, PROVIDERS, enabledProviders, readSession, notifyDownload } from '../shared/auth.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const MARKS = {
  google:
    '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>',
  facebook:
    '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#1877F2" d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7a3.2 3.2 0 0 1 3.4-3.5c1 0 2 .2 2 .2v2.2h-1.1c-1.1 0-1.5.7-1.5 1.4V9h2.5l-.4 2.6h-2.1v6.3A9 9 0 0 0 18 9z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#0A66C2" d="M15.3 0H2.7A2.6 2.6 0 0 0 0 2.6v12.8A2.6 2.6 0 0 0 2.7 18h12.6a2.6 2.6 0 0 0 2.7-2.6V2.6A2.6 2.6 0 0 0 15.3 0zM5.5 15.3H3V6.8h2.6v8.5zM4.2 5.6a1.5 1.5 0 1 1 0-3.1 1.5 1.5 0 0 1 0 3.1zM15.4 15.3h-2.6v-4.1c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.2H7.2V6.8h2.5V8a2.7 2.7 0 0 1 2.5-1.4c2.6 0 3.1 1.8 3.1 4v4.7z"/></svg>'
};

function signInPage(platform, file, providers) {
  const buttons = providers
    .map(
      (name) =>
        '<a class="provider" href="/auth/' + esc(name) + '?p=' + esc(platform) + '">' +
        (MARKS[name] || '') +
        '<span>Continue with ' + esc(PROVIDERS[name].label) + '</span></a>'
    )
    .join('\n      ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Download ${esc(file.label)} | Wasalea</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<main id="main" class="signin-wrap">
  <div class="signin">
    <a class="brand signin-brand" href="/" aria-label="Wasalea home">
      <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="currentColor"/>
        <path d="M7 11l3.2 10h2.6L16 13.6 19.2 21h2.6L25 11h-2.9l-1.9 6.7L17.3 11h-2.6l-2.9 6.7L9.9 11H7z" fill="#fff"/>
      </svg>
      <span class="brand-name">Wasalea</span>
    </a>

    <h1>Before you download</h1>
    <p class="signin-file">${esc(file.label)} &nbsp;&middot;&nbsp; ${esc(file.note)}</p>
    <p class="signin-why">
      Sign in so we know who is trying the software. We use it to offer help getting
      set up and to tell you about releases worth knowing about &mdash; nothing else,
      and you can ask us to delete it whenever you like.
    </p>

    <div class="providers">
      ${buttons}
    </div>

    <p class="signin-small">
      We receive your name and email address from whichever you choose, and nothing more.
      See the <a href="/privacy">privacy policy</a>.
    </p>
    <p class="signin-small"><a href="/#download">Back to the downloads</a></p>
  </div>
</main>
</body>
</html>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('p') || 'windows';
  const file = FILES[platform];

  if (!file) {
    return new Response('Unknown download.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const providers = enabledProviders(env);
  if (!providers.length) return Response.redirect(file.url, 302);

  const session = await readSession(request, env);
  if (session) {
    // Already signed in on this browser. Still worth recording: a second
    // download weeks later says more about intent than the first one did.
    await notifyDownload(env, {
      name: session.name,
      email: session.email,
      provider: session.provider,
      file: file.label,
      country: request.headers.get('cf-ipcountry'),
      returning: true
    });
    return Response.redirect(file.url, 302);
  }

  return new Response(signInPage(platform, file, providers), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
