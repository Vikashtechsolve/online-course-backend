/** Server-side Gen AI pricing (do not trust client amounts). */
const REGISTRATION_FEE = 1;
const COURSE_FEE = 4999;

const PAYMENT_PLANS = ["seat_booking", "full_payment"];

function fullPaymentAmount() {
  return COURSE_FEE;
}

function getAmountForPlan(paymentPlan) {
  if (paymentPlan === "seat_booking") return REGISTRATION_FEE;
  if (paymentPlan === "full_payment") return fullPaymentAmount();
  return null;
}

function getBalanceDue(paymentPlan) {
  if (paymentPlan === "seat_booking") return COURSE_FEE;
  if (paymentPlan === "full_payment") return 0;
  return COURSE_FEE;
}

module.exports = {
  REGISTRATION_FEE,
  COURSE_FEE,
  PAYMENT_PLANS,
  fullPaymentAmount,
  getAmountForPlan,
  getBalanceDue,
};
