const CourseLeadRegistration = require("../models/CourseLeadRegistration");
const { getAmountForPlan, getBalanceDue, fullPaymentAmount } = require("../constants/genAiFees");
const { verifyRazorpaySignature } = require("../utils/razorpayVerify");
const { issueRefund } = require("./razorpayRefund");
const { sendCourseRegistrationEmail } = require("./emailService");

const SUPPORT_EMAIL =
  process.env.COURSE_SUPPORT_EMAIL || "support@vikastechsolutions.com";

function paymentPlanLabel(plan) {
  if (plan === "seat_booking") return "Seat booking (₹99 now)";
  if (plan === "full_payment") return "Full payment (no registration fee)";
  return plan || "";
}

function formatRegistrationResponse(lead) {
  const batch = lead.intakeBatch;
  return {
    id: lead._id,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone || "",
    courseType: lead.courseType,
    batchName: batch?.displayName || "",
    batchStartDate: batch?.batchStartDate || null,
    paymentPlan: lead.paymentPlan,
    paymentPlanLabel: paymentPlanLabel(lead.paymentPlan),
    paymentStatus: lead.paymentStatus,
    amountPaid: lead.amountPaid,
    balanceDue: lead.balanceDue,
    registrationFee: lead.registrationFee,
    courseFee: lead.courseFee,
    discountPercent: lead.discountPercent,
    fullPaymentPrice: fullPaymentAmount(),
    razorpayPaymentId: lead.razorpayPaymentId,
    razorpayRefundId: lead.razorpayRefundId || "",
    paidAt: lead.paidAt,
  };
}

async function markLeadFailedWithRefund(lead, paymentId, amountInr, reason, refundData) {
  if (lead) {
    lead.paymentStatus = refundData?.id ? "refunded" : "failed";
    lead.razorpayPaymentId = paymentId || lead.razorpayPaymentId;
    if (refundData?.id) lead.razorpayRefundId = refundData.id;
    const note = `[${new Date().toISOString()}] ${reason}`;
    lead.adminNotes = lead.adminNotes ? `${lead.adminNotes}\n${note}` : note;
    await lead.save();
  }
}

/**
 * Complete paid registration after Razorpay checkout.
 * On failure after a valid payment, attempts automatic refund.
 */
async function completePaidRegistrationFlow(body) {
  const {
    registrationId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = body;

  if (
    !registrationId ||
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        message: "registrationId and Razorpay payment details are required",
      },
    };
  }

  let lead = null;

  async function failAfterPayment(message, status = 500) {
    let refundData = null;
    let refunded = false;

    try {
      const amount =
        lead && lead.paymentPlan
          ? getAmountForPlan(lead.paymentPlan)
          : null;
      refundData = await issueRefund(
        razorpay_payment_id,
        amount,
        message
      );
      refunded = Boolean(refundData?.id);
    } catch (refundErr) {
      console.error("Auto-refund failed:", refundErr.message);
    }

    await markLeadFailedWithRefund(
      lead,
      razorpay_payment_id,
      null,
      message,
      refundData
    );

    const refundNote = refunded
      ? ` Your payment has been refunded (ref: ${refundData.id}). It may take 5–7 business days to show in your account.`
      : ` Please contact ${SUPPORT_EMAIL} with payment ID ${razorpay_payment_id} for a manual refund.`;

    return {
      ok: false,
      status,
      body: {
        message: `${message}.${refundNote}`,
        refunded,
        refundId: refundData?.id || null,
        supportEmail: SUPPORT_EMAIL,
        paymentId: razorpay_payment_id,
      },
    };
  }

  let signatureValid = false;
  try {
    signatureValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
  } catch (e) {
    if (e.message === "Razorpay secret not configured") {
      return failAfterPayment(
        "Payment verification is not configured on the server"
      );
    }
    throw e;
  }

  if (!signatureValid) {
    return {
      ok: false,
      status: 400,
      body: { message: "Payment verification failed" },
    };
  }

  lead = await CourseLeadRegistration.findById(registrationId).populate(
    "intakeBatch",
    "displayName batchStartDate courseType"
  );

  if (!lead) {
    return failAfterPayment("Registration record not found", 404);
  }

  if (lead.paymentStatus === "completed") {
    return {
      ok: true,
      status: 200,
      body: {
        message: "Registration already confirmed",
        alreadyCompleted: true,
        registration: formatRegistrationResponse(lead),
      },
    };
  }

  const expectedAmount = getAmountForPlan(lead.paymentPlan);
  if (expectedAmount == null) {
    return failAfterPayment("Invalid payment plan on record", 400);
  }

  try {
    lead.razorpayOrderId = razorpay_order_id;
    lead.razorpayPaymentId = razorpay_payment_id;
    lead.amountPaid = expectedAmount;
    lead.balanceDue = getBalanceDue(lead.paymentPlan);
    lead.paymentStatus = "completed";
    lead.paidAt = new Date();
    lead.marketingStatus =
      lead.paymentPlan === "full_payment" ? "enrolled" : "qualified";

    await lead.save();
  } catch (saveErr) {
    console.error("Lead save failed after payment:", saveErr);
    return failAfterPayment("Could not save your registration");
  }

  let emailSent = false;
  let emailError = null;
  try {
    await sendCourseRegistrationEmail(lead, lead.intakeBatch);
    emailSent = true;
  } catch (emailErr) {
    emailError = emailErr.message || "Email could not be sent";
    console.error("Course registration confirmation email failed:", emailErr);
  }

  return {
    ok: true,
    status: 200,
    body: {
      message: emailSent
        ? "Registration confirmed successfully"
        : "Registration confirmed. Confirmation email could not be sent; our team will contact you shortly.",
      emailSent,
      emailError,
      registration: formatRegistrationResponse(lead),
    },
  };
}

module.exports = {
  completePaidRegistrationFlow,
  formatRegistrationResponse,
  paymentPlanLabel,
};
