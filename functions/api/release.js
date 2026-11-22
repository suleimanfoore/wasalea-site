/**
 * GET /api/release
 *
 * What is actually published: { version, windows, mac }, where the two sizes
 * are preformatted strings like "51 MB".
 *
 * The page carries its own version and sizes in the HTML, so crawlers and
 * anyone without JavaScript see something sensible. site.js calls this and
 * corrects them, which means shipping a release updates the website with no
 * edit and no deploy.
 *
 * Any field this cannot determine comes back null, and the page keeps what
 * it already had.
 */

import { getRelease } from '../../shared/auth.js';

export async function onRequestGet() {
  const release = await getRelease();

  return new Response(JSON.stringify(release), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // An hour is plenty: releases are occasional, and a visitor seeing an
      // hour-old version number has lost nothing.
      'cache-control': 'public, max-age=3600'
    }
  });
}
