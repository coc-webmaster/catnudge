/**
 * POST /api/batch
 * Saves parsed CSV transactions to Cloudflare D1
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_name, transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return new Response(JSON.stringify({ error: "No transactions provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const batchId = `batch_${Date.now()}`;
    const magicToken = crypto.randomUUID().slice(0, 8);
    const clientName = client_name || "Apex Construction LLC";

    // 1. Insert Batch metadata
    await env.DB.prepare(
      "INSERT INTO batches (id, client_name, magic_token, status) VALUES (?, ?, ?, 'active')"
    ).bind(batchId, clientName, magicToken).run();

    // 2. Prepare atomic batch SQL statements for transaction rows
    const stmts = transactions.map((t) =>
      env.DB.prepare(
        `INSERT INTO transactions 
        (id, batch_id, date, vendor, amount, suggested_category, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(
        t.id,
        batchId,
        t.date,
        t.vendor,
        t.amount,
        t.suggested_category || "Uncategorized"
      )
    );

    // Execute bulk insert in D1
    await env.DB.batch(stmts);

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        magicToken,
        shareUrl: `/nudge/${magicToken}`,
        count: transactions.length
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to persist batch to D1" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

/**
 * GET /api/batch?token=xyz
 * Fetches batch metadata and transaction list for client view
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const batch = await env.DB.prepare(
      "SELECT * FROM batches WHERE magic_token = ?"
    ).bind(token).first();

    if (!batch) {
      return new Response(JSON.stringify({ error: "Invalid or expired magic link" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results: transactions } = await env.DB.prepare(
      "SELECT * FROM transactions WHERE batch_id = ? ORDER BY date DESC"
    ).bind(batch.id).all();

    return new Response(
      JSON.stringify({
        batch_id: batch.id,
        client_name: batch.client_name,
        status: batch.status,
        transactions
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to fetch batch from D1" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}