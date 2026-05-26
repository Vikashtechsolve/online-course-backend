/**
 * Issue a Razorpay refund when registration cannot be completed after payment.
 */
async function issueRefund(paymentId, amountInr, reason) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;

  if (!keyId || !secret) {
    throw new Error("Razorpay credentials not configured for refunds");
  }
  if (!paymentId) {
    throw new Error("paymentId required for refund");
  }

  const amountPaise =
    typeof amountInr === "number" && amountInr > 0
      ? Math.round(amountInr * 100)
      : undefined;

  const body = {
    notes: { reason: String(reason || "Registration could not be completed").slice(0, 200) },
  };
  if (amountPaise) body.amount = amountPaise;

  const auth = Buffer.from(`${keyId}:${secret}`).toString("base64");
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.error?.description || data.error?.reason || res.statusText;
    throw new Error(errMsg || "Refund API failed");
  }

  console.log("Razorpay refund issued:", data.id, "for payment", paymentId);
  return data;
}

module.exports = { issueRefund };
