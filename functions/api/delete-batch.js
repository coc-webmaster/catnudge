// functions/api/delete-batch.js
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 });
    }

    const info = await env.DB.prepare("PRAGMA table_info(transactions)").all();
    const columns = (info.results || []).map(c => c.name);

    let tokenCol = 'batch_token';
    if (columns.includes('batch_token')) tokenCol = 'batch_token';
    else if (columns.includes('token')) tokenCol = 'token';
    else if (columns.includes('batch_id')) tokenCol = 'batch_id';
    else if (columns.includes('magic_token')) tokenCol = 'magic_token';

    await env.DB.prepare(`DELETE FROM transactions WHERE ${tokenCol} = ?`).bind(token).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}