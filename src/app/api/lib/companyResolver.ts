import mongoose from "mongoose";
import TravelCompany from "@/app/api/models/travelCompanyModel";

type TravelCompanyRecord = {
  _id: mongoose.Types.ObjectId;
  name: string;
  ownerUserId?: mongoose.Types.ObjectId;
  ownerEmail?: string;
  contact?: {
    email?: string;
    phone?: string;
  };
};

export type ResolveOperatorCompanyReason =
  | "INVALID_ID"
  | "NOT_FOUND"
  | "NO_COMPANY"
  | "MULTIPLE_COMPANIES";

export const resolveOperatorCompany = async (selection?: {
  companyId?: string;
  companyName?: string;
}): Promise<{
  company: TravelCompanyRecord | null;
  reason: ResolveOperatorCompanyReason | null;
}> => {
  const trimmedCompanyId = selection?.companyId?.trim() ?? "";
  const trimmedCompanyName = selection?.companyName?.trim() ?? "";

  if (trimmedCompanyId) {
    if (!mongoose.Types.ObjectId.isValid(trimmedCompanyId)) {
      return { company: null, reason: "INVALID_ID" };
    }

    const company = await TravelCompany.findById(trimmedCompanyId)
      .select("_id name ownerUserId ownerEmail contact")
      .lean<TravelCompanyRecord | null>();

    return company
      ? { company, reason: null }
      : { company: null, reason: "NOT_FOUND" };
  }

  if (trimmedCompanyName) {
    const company = await TravelCompany.findOne({
      name: {
        $regex: `^${trimmedCompanyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    })
      .select("_id name ownerUserId ownerEmail contact")
      .lean<TravelCompanyRecord | null>();

    return company
      ? { company, reason: null }
      : { company: null, reason: "NOT_FOUND" };
  }

  const companies = await TravelCompany.find({})
    .select("_id name ownerUserId ownerEmail contact")
    .sort({ createdAt: 1, _id: 1 })
    .limit(2)
    .lean<TravelCompanyRecord[]>();

  if (companies.length === 0) {
    return { company: null, reason: "NO_COMPANY" };
  }

  if (companies.length > 1) {
    return { company: null, reason: "MULTIPLE_COMPANIES" };
  }

  return { company: companies[0], reason: null };
};
