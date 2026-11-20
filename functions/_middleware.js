/**
 * Runs before every request to the site, static files included.
 *
 * Sends www.wasalea.com to the apex, so one hostname is canonical and search
 * engines do not see the same page at two addresses.
 *
 * A Cloudflare Redirect Rule on the zone would do this a step earlier, at the
 * edge, without invoking a Function. Doing it here instead keeps the rule in
 * the repo where it is visible and version-controlled. If the rule is ever
 * added in the dashboard, delete this file - the two would be redundant.
 */

const CANONICAL = 'wasalea.com';
const REDIRECT_FROM = 'www.wasalea.com';

export const onRequest = ({ request, next }) => {
  const url = new URL(request.url);

  if (url.hostname !== REDIRECT_FROM) return next();

  url.hostname = CANONICAL;
  // This branch only ever runs for the public www hostname, so https is always
  // right. Without it a plain-http request would be redirected to http on the
  // apex and then bounced to https by the edge - two hops instead of one.
  url.protocol = 'https:';
  url.port = '';

  // 301 is cached hard by browsers, which is what we want for GET. For other
  // methods it is the wrong answer: several clients downgrade a 301 to GET and
  // drop the body, so a POST would arrive empty. 308 keeps the method intact.
  const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;

  return new Response(null, {
    status,
    headers: { location: url.toString() }
  });
};
