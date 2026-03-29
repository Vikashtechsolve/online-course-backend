const mongoose = require("mongoose");

const batchStudentSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

batchStudentSchema.index({ batch: 1, student: 1 }, { unique: true });
batchStudentSchema.index({ batch: 1 });
batchStudentSchema.index({ student: 1 });

module.exports = mongoose.model("BatchStudent", batchStudentSchema);
