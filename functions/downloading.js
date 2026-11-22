/**
 * GET /downloading?p=windows|mac|guide
 *
 * Where sign-in lands. The page starts the download itself and leaves the
 * visitor on wasalea.com.
 *
 * Redirecting from the OAuth callback straight to the file looked fine in
 * testing and was wrong in use: the browser downloads the file without
 * navigating, so the last rendered page stays on screen - which, coming out
 * of Google, is one of Google's own interstitials. The visitor got their
 * installer and was left stranded on accounts.google.com with no way back.
 *
 * The download is started by a meta refresh rather than a script, so it
 * still works under a strict script-src and with JavaScript turned off.
 */

import { FILES, enabledProviders, readSession, getRelease } from '../shared/auth.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

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

  // Reached without signing in, while sign-in is available: send them to the
  // gate. The files are public, so this is not a security boundary - it just
  // stops the gate being sidestepped by a guessable URL.
  const providers = enabledProviders(env);
  if (providers.length && !(await readSession(request, env))) {
    return new Response(null, {
      status: 302,
      headers: { location: '/get?p=' + encodeURIComponent(platform), 'cache-control': 'no-store' }
    });
  }

  const release = await getRelease();
  const note = release[platform] ? file.kind + ', ' + release[platform] : file.kind;
  const href = esc(file.url);

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your download is starting | Wasalea</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="1; url=${href}">
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

    <h1>Your download is starting</h1>
    <p class="signin-file">${esc(file.label)} &nbsp;&middot;&nbsp; ${esc(note)}</p>
    <p class="signin-why">
      It should begin on its own in a moment. If nothing happens,
      <a href="${href}">start it manually</a>.
    </p>

    <div class="providers">
      <a class="btn btn-primary" href="/#download">Back to Wasalea</a>
    </div>

    <p class="signin-small">
      Stuck on the install, or want a hand setting up? Our support engineers
      would rather hear from you early than late &mdash;
      <a href="/#contact">get in touch</a>.
    </p>
  </div>
</main>
</body>
</html>`;

  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
