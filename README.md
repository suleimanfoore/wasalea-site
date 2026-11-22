# wasalea.com

The marketing site for the M-Pesa Liquidity Manager. Plain HTML and CSS, no
build step, deployed to Cloudflare Pages.

```
public/            everything the world sees
  index.html       the whole page
  styles.css       all the styling
  site.js          mobile nav + contact form submit
  _headers         security headers and cache rules
  assets/          favicon
functions/
  _middleware.js   301s www.wasalea.com to the apex, before anything else
  api/contact.js   POST /api/contact - emails the contact form
  get.js           /get - the download sign-in gate
  auth/            the OAuth round trip for Google, Facebook and LinkedIn
shared/
  auth.js          provider definitions, cookie signing, the lead email
wrangler.toml      Pages project config (no secrets in here)
```

## Changing the site

Edit the files in `public/` and redeploy. There is nothing to compile.

To see changes before they go live:

```powershell
npx wrangler pages dev .
```

That serves the site at <http://127.0.0.1:8788> with the contact function
running. For the form to actually send mail locally, copy
`.dev.vars.example` to `.dev.vars` and put a real Resend key in it -
`.dev.vars` is gitignored and must never be committed.

## Redeploying

```powershell
npx wrangler pages deploy
```

Run it from this folder. It uploads `public/` and the function, and prints
the deployment URL. The live site at <https://wasalea.com> updates within a
few seconds of the deploy finishing.

First time on a new machine you will be asked to log in:

```powershell
npx wrangler login
```

That opens a browser and signs wrangler into the Cloudflare account. It is a
one-off; the token is kept by wrangler, not in this repo.

### Or let GitHub do it

The Pages project can also be pointed at the GitHub repo
(`suleimanfoore/wasalea-site`) in the Cloudflare dashboard under
**Workers & Pages -> wasalea-site -> Settings -> Build**. With that connected,
pushing to `main` deploys on its own and `wrangler pages deploy` is no longer
needed.

## The contact form

`functions/api/contact.js` posts the submission to [Resend](https://resend.com)
and Resend sends the email. Three variables make that work, set in the
Cloudflare dashboard at **Workers & Pages -> wasalea-site -> Settings ->
Variables and secrets**:

| Name | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | Secret | API key from the Resend dashboard |
| `CONTACT_TO` | Text | the address enquiries should arrive at |
| `CONTACT_FROM` | Text | e.g. `Wasalea site <site@wasalea.com>` - the domain must be verified in Resend |

All three are set on Production as encrypted secrets. `CONTACT_TO` is
`info@wasalea.com`, which the zone's Email Routing catch-all forwards to the
owner's Gmail, so there is no mailbox to maintain. Add the same variables to
Preview if you want the form working on preview deployments. **Changing a
variable needs a redeploy before it takes effect** — the running deployment
keeps the values it was built with.

Until `RESEND_API_KEY` and `CONTACT_TO` are set, the endpoint answers 503 and
the form tells the visitor to try again later. It never silently swallows a
message.

Verifying `wasalea.com` in Resend means adding the DKIM and SPF records it
gives you to the Cloudflare DNS for the zone. Both live in the same Cloudflare
account, so it is a copy-and-paste job. That is already done.

## How mail to and from @wasalea.com works

Three separate pieces, worth keeping straight when one of them breaks:

**Incoming.** Cloudflare Email Routing on the zone has a catch-all that
forwards everything `@wasalea.com` to the owner's Gmail. There is no mailbox
to maintain and no quota to watch. Managed under **wasalea.com -> Email ->
Email Routing**.

**The contact form.** The Pages Function sends through Resend, from
`site@wasalea.com` to `info@wasalea.com`, which the catch-all then forwards.
So a form submission makes one outbound Resend send and one inbound forward.

**Replies.** Gmail is set up with "Send mail as" `info@wasalea.com`, relaying
through Resend's SMTP (`smtp.resend.com`, port 465, username `resend`,
password an API key). Replies therefore leave as `info@wasalea.com` rather
than the personal Gmail address.

Two consequences. The Resend free tier of 3,000 sends a month is **shared**
between the contact form and every reply. And if the zone's MX records are
ever changed - moving to Google Workspace or Zoho, say - Email Routing stops
and the catch-all with it, so `CONTACT_TO` would need pointing at the new
mailbox.

## The download sign-in gate

The three download buttons point at `/get?p=windows|mac|guide` rather than
straight at the release bucket. `functions/get.js` asks the visitor to sign in
with Google, Facebook or LinkedIn, records who they are, and then redirects to
the file. `shared/auth.js` holds the provider definitions and the signing.

**It is a lead gate, not a lock.** The release files stay on a public bucket
because the installed desktop app and the tablet both check that bucket for
updates - making it private would silently break update checking for every
existing customer. Anyone with a direct URL can still fetch the installer. The
gate records who comes through the website, which is all it is for. The
privacy policy says this in as many words; keep it that way.

### Behaviour when unconfigured

With no provider configured, **the gate fails open** and redirects straight to
the file. A download button that leads nowhere would cost a sale to protect
files that are public anyway. So deploying this code changes nothing visible
until credentials exist.

A provider appears only when **both** of its variables are set, so Facebook and
LinkedIn can be added later with no code change - their buttons appear by
themselves.

### Variables

Set under **Workers & Pages -> wasalea-site -> Settings -> Variables and
secrets**, as secrets:

| Name | Needed for |
|---|---|
| `SESSION_SECRET` | any provider. Already set. A long random string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | the Google button |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | the Facebook button |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | the LinkedIn button |

Changing a variable needs a redeploy before it takes effect.

### Creating the OAuth apps

The redirect URI is the same shape for all three:

```
https://wasalea.com/auth/callback/google
https://wasalea.com/auth/callback/facebook
https://wasalea.com/auth/callback/linkedin
```

- **Google** - console.cloud.google.com, APIs & Services -> Credentials ->
  OAuth client ID, type "Web application". Add the redirect URI above. Scopes
  are `openid email profile`, which are basic and need no verification review.
- **Facebook** - developers.facebook.com, add Facebook Login, set the Valid
  OAuth Redirect URI. Public use needs App Review and business verification,
  which takes time; until it passes, only accounts with a role on the app can
  sign in.
- **LinkedIn** - linkedin.com/developers, add the "Sign In with LinkedIn using
  OpenID Connect" product and set the redirect URL. That product needs
  approval before public use.

### What gets recorded

On each download, an email goes to `CONTACT_TO` with the name, email address,
which provider was used, which file, the country Cloudflare reports, and the
time. Repeat downloads are marked as returning. Nothing is stored
server-side - the email is the whole record - so there is no database of
prospects to leak. If a searchable list is wanted, add a KV or D1 write beside
the email in `notifyDownload`.

Lead email reuses the contact form's Resend configuration. If Resend is not
configured the download still works; only the notification is skipped.

## Domain

`wasalea.com` is registered at Cloudflare. Both it and `www.wasalea.com` are
attached to the Pages project under **Workers & Pages -> wasalea-site ->
Custom domains**, each with a proxied CNAME to `wasalea-site.pages.dev` in
the zone's DNS. Cloudflare issues and renews the HTTPS certificate.

The apex is canonical. `www.wasalea.com` 301-redirects to it, keeping the
path and query string, via `functions/_middleware.js` - not a dashboard
rule. Both approaches work; the code version is in the repo where it can be
seen and changed with everything else, at the cost of invoking a Function on
every request.

To move it to the edge instead, add a rule under **wasalea.com -> Rules ->
Redirect Rules** (hostname equals `www.wasalea.com`, dynamic redirect to
`concat("https://wasalea.com", http.request.uri.path)`, 301, preserve query
string) and **delete `functions/_middleware.js`** - running both is
redundant.

## Release downloads

The download buttons point at the public releases bucket:

```
https://mpesa-liquidity-releases.s3.us-east-1.amazonaws.com/LiquidityManager_Setup_latest.exe
https://mpesa-liquidity-releases.s3.us-east-1.amazonaws.com/LiquidityManager_Setup_latest.dmg
https://mpesa-liquidity-releases.s3.us-east-1.amazonaws.com/LiquidityManager_UserGuide_latest.pdf
```

Those are stable keys, so `scripts/publish_release.py` in the
mpesa-liquidity-manager repo updates what they serve and this site needs no
change - except the version number and file sizes written into
`public/index.html`, which are hardcoded and want updating when a release
changes them noticeably.

The Android APK is deliberately not linked: `LiquidityManager_latest.apk` in
that bucket is not public, so the tablet section points at the contact form
instead.
