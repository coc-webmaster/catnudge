// functions/api/batches.js
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const info = await env.DB.prepare("PRAGMA table_info(transactions)").all();
    const columns = (info.results || []).map(c => c.name);

    let tokenCol = 'batch_token';
    if (columns.includes('token')) tokenCol = 'token';
    else if (columns.includes('batch_id')) tokenCol = 'batch_id';
    else if (columns.includes('magic_token')) tokenCol = 'magic_token';

    const hasClientName = columns.includes('client_name');
    const clientSelect = hasClientName 
      ? `MAX(CASE WHEN client_name IS NOT NULL AND client_name != '' THEN client_name ELSE 'Unnamed Client' END) as client_name,` 
      : `'Unnamed Client' as client_name,`;

    const query = `
      SELECT 
        ${tokenCol} as batch_token,
        ${clientSelect}
        COUNT(id) as total_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM transactions
      WHERE ${tokenCol} IS NOT NULL AND ${tokenCol} != ''
      GROUP BY ${tokenCol}
    `;

    const { results } = await env.DB.prepare(query).all();

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