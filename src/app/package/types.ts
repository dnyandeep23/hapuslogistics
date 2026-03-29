export type PackageDraft = {
  packageName: string;
  packageType: string;
  otherPackageType: string;
  packageSize: string;
  packageWeight: number | "";
  packageQuantities: number;
  packageImage: string | File;
  pickUpDate: string;
  price?: number;
  [key: string]: unknown;
};

export type CartItem = PackageDraft & Record<string, unknown>;

export type PackageFormData = {
  pickupLocationId: string;
  dropLocationId: string;
  cart: CartItem[];
  senderName: string;
  senderContact: string;
  receiverName: string;
  receiverContact: string;
  coupon: string;
  discount: number;
};
