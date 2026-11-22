/**
 * GET /auth/callback/google|facebook|linkedin
 *
 * Finishes the OAuth round trip: swaps the code for tokens, reads the name
 * and email, records the lead, sets the session cookie and sends the visitor
 * on to their download.
 *
 * Every failure here ends with the visitor getting their file anyway. They
 * came for an installer, not to debug our sign-in, and the gate exists to
 * capture interest rather than to withhold software.
 */

import {
  PROVIDERS, FILES, providerConfigured, unpack, pack,
  readCookie, setCookie, SESSION_COOKIE, STATE_COOKIE, notifyDownload
} from '../../../shared/auth.js';

const STATE_MAX_AGE = 10 * 60 * 1000;        // ten minutes to complete sign-in
const SESSION_MAX_AGE = 90 * 24 * 60 * 60;   // ninety days signed in

function redirect(location, cookies = []) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  // Several Set-Cookie headers cannot be expressed in a plain object, so
  // they are appended one at a time.
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env, params }) {
  const name = String(params.provider || '').toLowerCase();
  const provider = PROVIDERS[name];
  const url = new URL(request.url);

  const stateParam = url.searchParams.get('state');
  const code = url.searchParams.get('code');

  // Work out where they were heading before anything can go wrong, so every
  // early exit below still has a file to fall back to.
  const state = provider && env.SESSION_SECRET ? await unpack(stateParam, env.SESSION_SECRET) : null;
  const platform = state && FILES[state.p] ? state.p : 'windows';
  const file = FILES[platform];
  const clearState = setCookie(STATE_COOKIE, '', 0);

  if (!provider || !providerConfigured(env, name)) return redirect(file.url);

  // The visitor declined at the provider, or the provider refused.
  if (!code) return redirect('/#download', [clearState]);

  const nonce = readCookie(request, STATE_COOKIE);
  if (!state || !nonce || state.n !== nonce || Date.now() - state.t > STATE_MAX_AGE) {
    // Forged, replayed or simply stale. Nothing is recorded, and they still
    // get the file.
    return redirect(file.url, [clearState]);
  }

  let profile = {};
  try {
    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env[provider.idEnv],
        client_secret: env[provider.secretEnv],
        redirect_uri: url.origin + '/auth/callback/' + name
      })
    });

    if (!res.ok) {
      console.error('token exchange failed', name, res.status, await res.text().catch(() => ''));
      return redirect(file.url, [clearState]);
    }

    profile = (await provider.profile(await res.json())) || {};
  } catch (err) {
    console.error('sign-in failed', name, err);
    return redirect(file.url, [clearState]);
  }

  await notifyDownload(env, {
    name: profile.name,
    email: profile.email,
    provider: provider.label,
    file: file.label,
    country: request.headers.get('cf-ipcountry'),
    returning: false
  });

  const session = await pack(
    {
      name: profile.name || '',
      email: profile.email || '',
      provider: provider.label,
      exp: Date.now() + SESSION_MAX_AGE * 1000
    },
    env.SESSION_SECRET
  );

  return redirect(file.url, [setCookie(SESSION_COOKIE, session, SESSION_MAX_AGE), clearState]);
}
