import mongoose, { Schema, Document, models } from "mongoose";

export interface IPackageCategory {
  name: string;
  icon: string;
  defaultFare: number;
  isActive: boolean;
  sortOrder: number;
}

export interface IPackageSize {
  name: string;
  description: string;
  maxWeightKg: number;
  priceMultiplier: number;
  visualScale: number;
  isActive: boolean;
  sortOrder: number;
}

export interface IPackageCatalog extends Document {
  key: string;
  categories: IPackageCategory[];
  sizes: IPackageSize[];
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PackageCategorySchema = new Schema<IPackageCategory>(
  {
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "mdi:shape-outline" },
    defaultFare: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const PackageSizeSchema = new Schema<IPackageSize>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    maxWeightKg: { type: Number, required: true, min: 0.1 },
    priceMultiplier: { type: Number, required: true, min: 0.1 },
    visualScale: { type: Number, default: 1, min: 0.5 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const PackageCatalogSchema = new Schema<IPackageCatalog>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    categories: { type: [PackageCategorySchema], default: [] },
    sizes: { type: [PackageSizeSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "users" },
  },
  { timestamps: true },
);

if (models.PackageCatalog) {
  delete (models as { PackageCatalog?: unknown }).PackageCatalog;
}

const PackageCatalog = mongoose.model<IPackageCatalog>("PackageCatalog", PackageCatalogSchema);

export default PackageCatalog;
