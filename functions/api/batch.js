// functions/api/batch.js
export async function onRequest(context) {
  const { request, env } = context;

  // GET /api/batch?token=...
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 });

    try {
      const info = await env.DB.prepare("PRAGMA table_info(transactions)").all();
      const columns = (info.results || []).map(c => c.name);

      let tokenCol = 'batch_token';
      if (columns.includes('token')) tokenCol = 'token';
      else if (columns.includes('batch_id')) tokenCol = 'batch_id';
      else if (columns.includes('magic_token')) tokenCol = 'magic_token';

      const hasClientName = columns.includes('client_name');
      const clientSelect = hasClientName ? 'client_name,' : '';

      const { results } = await env.DB.prepare(`
        SELECT id, date, vendor, amount, suggested_category, selected_category, client_note, receipt_url, status, ${clientSelect} ${tokenCol} as batch_token
        FROM transactions
        WHERE ${tokenCol} = ?
      `).bind(token).all();

      const clientName = (results && results[0] && results[0].client_name) ? results[0].client_name : 'Client Batch';

      return new Response(JSON.stringify({ transactions: results || [], client_name: clientName }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // POST /api/batch (Create new batch from CSV)
  if (request.method === 'POST') {
    try {
      const { client_name, transactions } = await request.json();
      const magicToken = 'm_' + Math.random().toString(36).substring(2, 10);

      const info = await env.DB.prepare("PRAGMA table_info(transactions)").all();
      const columns = (info.results || []).map(c => c.name);

      let tokenCol = 'batch_token';
      if (columns.includes('token')) tokenCol = 'token';
      else if (columns.includes('batch_id')) tokenCol = 'batch_id';
      else if (columns.includes('magic_token')) tokenCol = 'magic_token';

      const hasClientName = columns.includes('client_name');

      for (const t of transactions) {
        if (hasClientName) {
          await env.DB.prepare(`
            INSERT INTO transactions (id, ${tokenCol}, client_name, date, vendor, amount, suggested_category, selected_category, client_note, receipt_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            t.id,
            magicToken,
            client_name || 'New Client',
            t.date,
            t.vendor,
            t.amount,
            t.suggested_category || 'Uncategorized',
            t.selected_category || null,
            t.client_note || '',
            t.receipt_url || null,
            t.status || 'pending'
          ).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO transactions (id, ${tokenCol}, date, vendor, amount, suggested_category, selected_category, client_note, receipt_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            t.id,
            magicToken,
            t.date,
            t.vendor,
            t.amount,
            t.suggested_category || 'Uncategorized',
            t.selected_category || null,
            t.client_note || '',
            t.receipt_url || null,
            t.status || 'pending'
          ).run();
        }
      }

      return new Response(JSON.stringify({ magicToken, client_name }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
}