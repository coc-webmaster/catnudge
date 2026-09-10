// functions/api/batches.js
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Query D1 using standard transaction columns
    const { results } = await env.DB.prepare(`
      SELECT 
        batch_token,
        client_name,
        COUNT(id) as total_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM transactions
      WHERE batch_token IS NOT NULL AND batch_token != ''
      GROUP BY batch_token, client_name
    `).all();

    return new Response(JSON.stringify({ batches: results || [] }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, batches: [] }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}