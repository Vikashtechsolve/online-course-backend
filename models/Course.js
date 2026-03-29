const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch is required"],
    },
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// slug unique per batch
courseSchema.index({ batch: 1, slug: 1 }, { unique: true });
courseSchema.index({ batch: 1 });
courseSchema.index({ isActive: 1 });

module.exports = mongoose.model("Course", courseSchema);
