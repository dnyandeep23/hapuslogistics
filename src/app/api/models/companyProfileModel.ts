import mongoose, { Schema, Document, models } from "mongoose";

export interface ICompanyProfile extends Document {
  companyName: string;
  address: string;
  supportEmail: string;
  supportPhone: string;
  websiteDomain: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyProfileSchema = new Schema<ICompanyProfile>(
  {
    companyName: { type: String, required: true, trim: true, default: "Hapus Logistics" },
    address: { type: String, required: true, trim: true, default: "138/D, Kinny House Room No. 1, 2nd Floor, near Parcel ST Depot, Pune, Maharashtra 411001" },
    supportEmail: { type: String, trim: true, lowercase: true, default: "support@hapuslogistics.com" },
    supportPhone: { type: String, trim: true, default: "+91 98765 43210" },
    websiteDomain: { type: String, trim: true, default: "https://hapuslogistics.com" },
    logoUrl: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

if (models.CompanyProfile) {
  delete (models as { CompanyProfile?: unknown }).CompanyProfile;
}

const CompanyProfile = mongoose.model<ICompanyProfile>("CompanyProfile", CompanyProfileSchema);

export default CompanyProfile;
