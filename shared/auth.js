/**
 * Shared helpers for the download sign-in gate.
 *
 * This is a LEAD GATE, not a security control, and the distinction is
 * deliberate. The release files stay on a public S3 bucket because the
 * installed desktop app and the tablet both check that bucket for updates;
 * making it private would silently break update checking for every existing
 * customer. Anyone holding a direct URL can still fetch the installer. The
 * point of this gate is to learn who is evaluating the product, not to stop
 * anyone getting it.
 *
 * Environment variables, set in the Cloudflare dashboard (never in the repo):
 *
 *   SESSION_SECRET           random string; signs the session cookie
 *   GOOGLE_CLIENT_ID         - each provider is enabled only when BOTH of
 *   GOOGLE_CLIENT_SECRET       its variables are present, so Facebook and
 *   FACEBOOK_CLIENT_ID         LinkedIn can be added later without a code
 *   FACEBOOK_CLIENT_SECRET     change: their buttons appear on their own.
 *   LINKEDIN_CLIENT_ID
 *   LINKEDIN_CLIENT_SECRET
 *
 * With no provider configured the gate fails OPEN and hands over the file. A
 * marketing site that cannot serve its own installer is worse than an
 * ungated one, and the files are public regardless.
 */

const RELEASES = 'https://mpesa-liquidity-releases.s3.us-east-1.amazonaws.com';

export const FILES = {
  windows: {
    label: 'Liquidity Manager for Windows',
    kind: 'Installer',
    note: 'Installer',
    url: RELEASES + '/LiquidityManager_Setup_latest.exe'
  },
  mac: {
    label: 'Liquidity Manager for macOS',
    kind: 'Disk image',
    note: 'Disk image',
    url: RELEASES + '/LiquidityManager_Setup_latest.dmg'
  },
  guide: {
    label: 'The Liquidity Manager user guide',
    kind: 'PDF',
    note: 'PDF',
    url: RELEASES + '/LiquidityManager_UserGuide_latest.pdf'
  }
};

/* ---------- what is actually published right now ---------- */

const VERSION_URL = RELEASES + '/latest_version.txt';

// Same binary megabyte the sizes were originally written in, so a release
// that has not changed produces the same string as before.
const mb = (bytes) => (bytes ? Math.round(bytes / (1024 * 1024)) + ' MB' : null);

async function sizeOf(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length'));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}

async function fetchRelease() {
  const [versionText, winBytes, macBytes] = await Promise.all([
    fetch(VERSION_URL).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    sizeOf(FILES.windows.url),
    sizeOf(FILES.mac.url)
  ]);

  // Only accept something that looks like a version. The page falls back to
  // its own text rather than printing whatever the bucket happened to hold.
  const trimmed = (versionText || '').trim();
  const version = /^\d+(\.\d+){1,3}$/.test(trimmed) ? trimmed : null;

  return { version, windows: mb(winBytes), mac: mb(macBytes) };
}

/**
 * The published version and installer sizes, read from the releases bucket
 * so the site cannot drift out of date when a release ships.
 *
 * Cached for an hour at the edge. Any failure returns nulls, and every
 * caller falls back to the text already in the page - stale beats blank,
 * and a release is not worth a broken download section.
 */
export async function getRelease() {
  const key = 'https://wasalea.com/__release';
  const cache = typeof caches !== 'undefined' ? caches.default : null;

  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }

  const data = await fetchRelease();

  if (cache && data.version) {
    await cache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' }
      })
    );
  }

  return data;
}

export const PROVIDERS = {
  google: {
    label: 'Google',
    idEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    // Google and LinkedIn both return an OIDC id_token from their token
    // endpoint over TLS, so its claims can be read directly.
    profile: (tokens) => fromIdToken(tokens.id_token)
  },
  facebook: {
    label: 'Facebook',
    idEnv: 'FACEBOOK_CLIENT_ID',
    secretEnv: 'FACEBOOK_CLIENT_SECRET',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scope: 'email public_profile',
    profile: async (tokens) => {
      const res = await fetch('https://graph.facebook.com/v21.0/me?fields=name,email', {
        headers: { authorization: 'Bearer ' + tokens.access_token }
      });
      if (!res.ok) return {};
      const body = await res.json();
      return { name: body.name, email: body.email };
    }
  },
  linkedin: {
    label: 'LinkedIn',
    idEnv: 'LINKEDIN_CLIENT_ID',
    secretEnv: 'LINKEDIN_CLIENT_SECRET',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'openid profile email',
    profile: (tokens) => fromIdToken(tokens.id_token)
  }
};

function fromIdToken(idToken) {
  if (!idToken) return {};
  const part = String(idToken).split('.')[1];
  if (!part) return {};
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(part)));
    return { name: claims.name, email: claims.email };
  } catch {
    return {};
  }
}

export const providerConfigured = (env, name) => {
  const p = PROVIDERS[name];
  return Boolean(p && env[p.idEnv] && env[p.secretEnv] && env.SESSION_SECRET);
};

export const enabledProviders = (env) =>
  Object.keys(PROVIDERS).filter((name) => providerConfigured(env, name));

/* ---------- base64url ---------- */

function toB64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- signing ---------- */

const keyFor = (secret) =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

export async function sign(value, secret) {
  const sig = await crypto.subtle.sign('HMAC', await keyFor(secret), new TextEncoder().encode(value));
  return value + '.' + toB64url(sig);
}

export async function unsign(signed, secret) {
  if (typeof signed !== 'string') return null;
  const cut = signed.lastIndexOf('.');
  if (cut < 1) return null;
  const value = signed.slice(0, cut);
  const expected = await sign(value, secret);
  // Compare the whole string rather than bailing at the first differing
  // byte, so response timing cannot be used to forge a signature.
  if (expected.length !== signed.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signed.charCodeAt(i);
  return diff === 0 ? value : null;
}

export async function pack(payload, secret) {
  return sign(toB64url(new TextEncoder().encode(JSON.stringify(payload))), secret);
}

export async function unpack(signed, secret) {
  const value = await unsign(signed, secret);
  if (!value) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(value)));
  } catch {
    return null;
  }
}

/* ---------- cookies ---------- */

export const SESSION_COOKIE = 'wsl_id';
export const STATE_COOKIE = 'wsl_oauth';

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0 && trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export const setCookie = (name, value, maxAge) =>
  name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;

export async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const session = await unpack(raw, env.SESSION_SECRET);
  if (!session || typeof session.exp !== 'number') return null;
  return session.exp > Date.now() ? session : null;
}

/* ---------- the record of who downloaded ---------- */

/**
 * Emails the business a record of a download.
 *
 * Deliberately never throws and never blocks: a failed notification must not
 * cost a visitor their installer. Reuses the contact form's Resend setup, so
 * no new configuration is needed.
 *
 * The email is the whole record. Nothing is stored server-side, which keeps
 * the privacy promise simple and leaves no database of prospects to leak. If
 * a searchable list is wanted later, this is where a write to KV or D1 goes,
 * beside the email rather than instead of it.
 */
export async function notifyDownload(env, lead) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) return;

  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const who = lead.name || lead.email || 'someone';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.RESEND_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM || 'Wasalea site <onboarding@resend.dev>',
        to: [env.CONTACT_TO],
        ...(lead.email ? { reply_to: lead.email } : {}),
        subject: 'Download - ' + who + (lead.returning ? ' (returning)' : ''),
        text: [
          'Name:           ' + (lead.name || '-'),
          'Email:          ' + (lead.email || '(not shared)'),
          'Signed in with: ' + lead.provider,
          '',
          'Downloaded:     ' + lead.file,
          'Country:        ' + (lead.country || 'unknown'),
          'When:           ' + when,
          '',
          lead.returning
            ? 'Already signed in on this browser, so the gate let them straight through.'
            : 'First sign-in from this browser.',
          '',
          '--',
          'From the wasalea.com download gate. The installer sits on a public',
          'bucket so the app can check for updates, so this records who came',
          'through the website, not everyone who obtained the file.'
        ].join('\n')
      })
    });
  } catch (err) {
    console.error('download notify failed', err);
  }
}
