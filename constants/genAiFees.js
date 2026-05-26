/** Server-side Gen AI pricing (do not trust client amounts). */
const REGISTRATION_FEE = 99;
const COURSE_FEE = 5999;
const FULL_PAY_DISCOUNT_PERCENT = 10;

const PAYMENT_PLANS = ["seat_booking", "full_payment"];

function fullPaymentAmount() {
  return Math.round(COURSE_FEE * (1 - FULL_PAY_DISCOUNT_PERCENT / 100));
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
  FULL_PAY_DISCOUNT_PERCENT,
  PAYMENT_PLANS,
  fullPaymentAmount,
  getAmountForPlan,
  getBalanceDue,
};
