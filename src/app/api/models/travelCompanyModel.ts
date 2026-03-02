import mongoose from "mongoose";

const travelCompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  ownerEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  contact: {
    email: String,
    phone: String,
  },
}, { timestamps: true });

const TravelCompany = mongoose.models.TravelCompany || mongoose.model("TravelCompany", travelCompanySchema);

export default TravelCompany;
