const mongoose = require("mongoose");

const announcementReadSchema = new mongoose.Schema(
  {
    announcement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

announcementReadSchema.index({ announcement: 1, student: 1 }, { unique: true });
announcementReadSchema.index({ student: 1, readAt: -1 });

module.exports = mongoose.model("AnnouncementRead", announcementReadSchema);
