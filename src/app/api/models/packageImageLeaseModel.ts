import mongoose, { Schema, type Document } from "mongoose";

export interface IPackageImageLease extends Document {
  userId: mongoose.Types.ObjectId;
  imageUrl: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PackageImageLeaseSchema = new Schema<IPackageImageLease>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

const PackageImageLease =
  mongoose.models.PackageImageLease ||
  mongoose.model<IPackageImageLease>("PackageImageLease", PackageImageLeaseSchema);

export default PackageImageLease;
