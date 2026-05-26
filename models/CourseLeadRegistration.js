const mongoose = require("mongoose");

const COURSE_TYPES = ["fullstack_developer", "data_analytics", "generative_ai"];
const PROGRAMS = ["mini", "macro", "standard"];
const PAYMENT_PLANS = ["seat_booking", "full_payment"];
const PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"];
const MARKETING_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "not_interested",
  "enrolled",
];

const courseLeadRegistrationSchema = new mongoose.Schema(
  {
    intakeBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseIntakeBatch",
      required: true,
      index: true,
    },
    courseType: {
      type: String,
      required: true,
      enum: COURSE_TYPES,
      index: true,
    },
    program: {
      type: String,
      required: true,
      enum: PROGRAMS,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    currentStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    howHeard: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    consentMarketing: {
      type: Boolean,
      default: false,
    },
    marketingStatus: {
      type: String,
      enum: MARKETING_STATUSES,
      default: "new",
      index: true,
    },
    adminNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },
    paymentPlan: {
      type: String,
      enum: [...PAYMENT_PLANS, null],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: [...PAYMENT_STATUSES, null],
      default: null,
      index: true,
    },
    registrationFee: { type: Number, default: 0 },
    courseFee: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpayRefundId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

courseLeadRegistrationSchema.index({ createdAt: -1 });
courseLeadRegistrationSchema.index({ intakeBatch: 1, createdAt: -1 });
courseLeadRegistrationSchema.index({ email: 1 });
courseLeadRegistrationSchema.index({ razorpayOrderId: 1 }, { sparse: true });

module.exports = mongoose.model("CourseLeadRegistration", courseLeadRegistrationSchema);
module.exports.MARKETING_STATUSES = MARKETING_STATUSES;
module.exports.PROGRAMS = PROGRAMS;
module.exports.PAYMENT_PLANS = PAYMENT_PLANS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
