/**
 * GET /api/nudge/[token]
 * Fetches batch details and transactions associated with a magic token
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing magic token." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Fetch batch metadata by magic_token
    const batch = await env.DB.prepare(
      "SELECT id, client_name, status, created_at FROM batches WHERE magic_token = ?"
    ).bind(token).first();

    if (!batch) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired magic link." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch all transactions for this batch
    const { results: transactions } = await env.DB.prepare(
      `SELECT id, date, vendor, amount, suggested_category, selected_category, client_note, receipt_url, status 
       FROM transactions 
       WHERE batch_id = ? 
       ORDER BY date DESC`
    ).bind(batch.id).all();

    // 3. Return client payload
    return new Response(
      JSON.stringify({
        batchId: batch.id,
        clientName: batch.client_name,
        batchStatus: batch.status,
        transactions: transactions || [],
        pendingCount: transactions.filter(t => t.status === 'pending').length,
        completedCount: transactions.filter(t => t.status === 'completed').length
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store" // Prevent stale browser caching on mobile
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to fetch transactions from D1." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}