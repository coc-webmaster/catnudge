/**
 * GET /api/receipt/[key]
 * Fetches and streams receipt images from R2 to the browser
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const key = decodeURIComponent(params.key);

  if (!key) {
    return new Response("Missing image key", { status: 400 });
  }

  // Fetch object from Cloudflare R2
  const object = await env.RECEIPTS_BUCKET.get(key);

  if (!object) {
    return new Response("Receipt image not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000"); // Cache in browser

  return new Response(object.body, { headers });
}