const mongoose = require("mongoose");

const lectureDiscussionSchema = new mongoose.Schema(
  {
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

lectureDiscussionSchema.index({ lecture: 1 });

module.exports = mongoose.model("LectureDiscussion", lectureDiscussionSchema);
