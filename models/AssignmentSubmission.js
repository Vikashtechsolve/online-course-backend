const mongoose = require("mongoose");

const SUBMISSION_STATUS = ["pending", "submitted", "graded"];

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submissionLink: {
      type: String,
      default: "",
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: SUBMISSION_STATUS,
      default: "pending",
    },
    grade: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    feedback: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
assignmentSubmissionSchema.index({ student: 1 });

module.exports = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
