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
  api/contact.js   POST /api/contact - emails the contact form
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
account, so it is a copy-and-paste job.

## Domain

`wasalea.com` is registered at Cloudflare. Both it and `www.wasalea.com` are
attached to the Pages project under **Workers & Pages -> wasalea-site ->
Custom domains**, each with a proxied CNAME to `wasalea-site.pages.dev` in
the zone's DNS. Cloudflare issues and renews the HTTPS certificate.

The apex is meant to be the canonical hostname, but **both hostnames
currently serve the site**. To make `www` redirect, add a rule under
**wasalea.com -> Rules -> Redirect Rules**: hostname equals
`www.wasalea.com`, dynamic redirect to
`concat("https://wasalea.com", http.request.uri.path)`, status 301,
preserve query string. Until then the same content answers on two
hostnames, which splits search ranking between them. The `<link rel=canonical>`
in `index.html` points at the apex, which limits the damage but is not a
substitute for the redirect.

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
