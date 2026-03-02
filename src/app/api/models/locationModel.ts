import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  geoPoint: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: undefined,
    },
  },
});

// Create a compound index for efficient lookups
locationSchema.index({ name: 1, city: 1, state: 1 }, { unique: true });
locationSchema.index({ geoPoint: "2dsphere" });

locationSchema.pre("validate", function syncGeoPoint() {
  const latitude = Number(this.get("latitude"));
  const longitude = Number(this.get("longitude"));

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    this.set("geoPoint", {
      type: "Point",
      coordinates: [longitude, latitude],
    });
  } else {
    this.set("geoPoint", undefined);
  }
});

const Location = mongoose.models.Location || mongoose.model("Location", locationSchema);

export default Location;
