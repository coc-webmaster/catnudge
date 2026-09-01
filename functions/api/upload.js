/**
 * POST /api/upload
 * Accepts a receipt image file and saves it directly to Cloudflare R2
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const transactionId = formData.get('transaction_id') || `txn_${Date.now()}`;

    if (!file || typeof file === 'string') {
      return new Response(
        JSON.stringify({ error: "No image file provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine file extension and content type
    const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
    const objectKey = `receipts/${transactionId}_${Date.now()}.${fileExt}`;
    const contentType = file.type || 'image/jpeg';

    // Write file directly into Cloudflare R2 Bucket
    await env.RECEIPTS_BUCKET.put(objectKey, file.stream(), {
      httpMetadata: { contentType: contentType }
    });

    // Public / API served URL path for the receipt
    const receiptUrl = `/api/receipt/${encodeURIComponent(objectKey)}`;

    return new Response(
      JSON.stringify({
        success: true,
        key: objectKey,
        receiptUrl: receiptUrl
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to upload receipt to Cloudflare R2." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}