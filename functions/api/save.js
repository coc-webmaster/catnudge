// functions/api/save.js
export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    const { transaction_id, selected_category, client_note } = body;

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: 'Missing transaction_id' }), { status: 400 });
    }

    // Update D1 database record
    await env.DB.prepare(`
      UPDATE transactions 
      SET selected_category = ?, client_note = ?, status = 'completed' 
      WHERE id = ?
    `).bind(selected_category || null, client_note || '', transaction_id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}