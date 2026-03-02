import mongoose, { Schema } from "mongoose";

const bannerSlideSchema = new Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const dashboardBannerSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slides: {
      type: [bannerSlideSchema],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  },
  { timestamps: true },
);

const DashboardBanner =
  mongoose.models.DashboardBanner ||
  mongoose.model("DashboardBanner", dashboardBannerSchema);

export default DashboardBanner;
