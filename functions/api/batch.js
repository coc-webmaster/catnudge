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
      if (columns.includes('batch_token')) tokenCol = 'batch_token';
      else if (columns.includes('token')) tokenCol = 'token';
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

  // POST /api/batch (Create new batch from CSV with dynamic schema matching)
  if (request.method === 'POST') {
    try {
      const { client_name, transactions } = await request.json();
      const magicToken = 'm_' + Math.random().toString(36).substring(2, 10);

      const info = await env.DB.prepare("PRAGMA table_info(transactions)").all();
      const columns = (info.results || []).map(c => c.name);

      let tokenCol = 'batch_token';
      if (columns.includes('batch_token')) tokenCol = 'batch_token';
      else if (columns.includes('token')) tokenCol = 'token';
      else if (columns.includes('batch_id')) tokenCol = 'batch_id';
      else if (columns.includes('magic_token')) tokenCol = 'magic_token';

      for (const t of transactions) {
        const rowData = {};
        if (columns.includes('id')) rowData.id = t.id;
        if (columns.includes(tokenCol)) rowData[tokenCol] = magicToken;
        if (columns.includes('client_name')) rowData.client_name = client_name || 'New Client';
        if (columns.includes('date')) rowData.date = t.date;
        if (columns.includes('vendor')) rowData.vendor = t.vendor;
        if (columns.includes('amount')) rowData.amount = t.amount;

        if (columns.includes('suggested_category')) rowData.suggested_category = t.suggested_category || 'Uncategorized';

        if (columns.includes('selected_category')) rowData.selected_category = t.selected_category || null;
        else if (columns.includes('category')) rowData.category = t.selected_category || null;

        if (columns.includes('client_note')) rowData.client_note = t.client_note || '';
        else if (columns.includes('note')) rowData.note = t.client_note || '';

        if (columns.includes('receipt_url')) rowData.receipt_url = t.receipt_url || null;
        if (columns.includes('status')) rowData.status = t.status || 'pending';

        const colKeys = Object.keys(rowData);
        const placeholders = colKeys.map(() => '?').join(', ');
        const sql = `INSERT INTO transactions (${colKeys.join(', ')}) VALUES (${placeholders})`;

        await env.DB.prepare(sql).bind(...Object.values(rowData)).run();
      }

      return new Response(JSON.stringify({ magicToken, client_name }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
}