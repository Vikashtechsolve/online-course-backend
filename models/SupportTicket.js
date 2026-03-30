const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    authorRole: {
      type: String,
      enum: ["student", "staff"],
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    attachmentName: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 20000 },
    course: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    attachmentName: { type: String, default: "", trim: true },
    attachmentUrl: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ student: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
