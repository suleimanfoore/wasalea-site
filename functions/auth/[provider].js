/**
 * GET /auth/google|facebook|linkedin?p=windows
 *
 * Starts the OAuth round trip: builds the provider's authorize URL and sends
 * the visitor there.
 *
 * The `state` parameter carries the chosen download and a nonce, signed with
 * SESSION_SECRET. The same nonce also goes into a short-lived cookie, and the
 * callback requires the two to match. Signing alone would not be enough: a
 * signed state is still replayable by whoever obtains it, whereas the cookie
 * ties the round trip to the browser that began it.
 */

import { PROVIDERS, FILES, providerConfigured, pack, setCookie, STATE_COOKIE } from '../../shared/auth.js';

export async function onRequestGet({ request, env, params }) {
  const name = String(params.provider || '').toLowerCase();
  const provider = PROVIDERS[name];

  if (!provider || !providerConfigured(env, name)) {
    return new Response('That sign-in method is not available.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const url = new URL(request.url);
  const asked = url.searchParams.get('p');
  const platform = FILES[asked] ? asked : 'windows';

  const nonce = crypto.randomUUID();
  const state = await pack({ n: nonce, p: platform, t: Date.now() }, env.SESSION_SECRET);

  const authorize = new URL(provider.authUrl);
  authorize.searchParams.set('client_id', env[provider.idEnv]);
  authorize.searchParams.set('redirect_uri', url.origin + '/auth/callback/' + name);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', provider.scope);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      // Ten minutes: long enough to sign in, short enough that an abandoned
      // attempt does not linger in the browser.
      'set-cookie': setCookie(STATE_COOKIE, nonce, 600),
      'cache-control': 'no-store'
    }
  });
}
