/**
 * POST /api/nudge/submit
 * Updates transaction category, note, and receipt in D1
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { transaction_id, selected_category, client_note, receipt_url } = body;

    if (!transaction_id || !selected_category) {
      return new Response(
        JSON.stringify({ error: "Transaction ID and selected category are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update transaction in Cloudflare D1
    const result = await env.DB.prepare(
      `UPDATE transactions 
       SET selected_category = ?, client_note = ?, receipt_url = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(
      selected_category,
      client_note || "",
      receipt_url || null,
      transaction_id
    ).run();

    if (result.meta.changes === 0) {
      return new Response(
        JSON.stringify({ error: "Transaction record not found." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, transaction_id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to update transaction in D1." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}