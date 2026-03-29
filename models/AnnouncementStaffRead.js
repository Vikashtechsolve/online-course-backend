const mongoose = require("mongoose");

const announcementStaffReadSchema = new mongoose.Schema(
  {
    announcement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
    },
    user: {
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

announcementStaffReadSchema.index({ announcement: 1, user: 1 }, { unique: true });
announcementStaffReadSchema.index({ user: 1, readAt: -1 });

module.exports = mongoose.model("AnnouncementStaffRead", announcementStaffReadSchema);
