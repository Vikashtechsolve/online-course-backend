const mongoose = require("mongoose");

const LECTURE_STATUS = ["draft", "upcoming", "live", "completed", "recorded"];

const lectureSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
      maxlength: 300,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: LECTURE_STATUS,
      default: "draft",
    },
    meetingLink: {
      type: String,
      default: "",
      trim: true,
    },
    videoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      image: { type: String, default: "" },
      pdf: { type: String, default: "" },
    },
    ppt: {
      slides: [{ type: String }],
      fileUrl: { type: String, default: "" },
    },
    testLink: {
      type: String,
      default: "",
      trim: true,
    },
    practiceContent: {
      type: String,
      default: "",
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

lectureSchema.index({ course: 1 });
lectureSchema.index({ teacher: 1 });
lectureSchema.index({ course: 1, order: 1 });

lectureSchema.statics.STATUS = LECTURE_STATUS;

module.exports = mongoose.model("Lecture", lectureSchema);
module.exports.LECTURE_STATUS = LECTURE_STATUS;
