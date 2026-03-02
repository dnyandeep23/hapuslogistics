import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    authProvider: {
      type: [String],
      enum: ["local", "google"],
      default: ["local"],
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: function (this: { authProvider?: string | string[] }) {
        const providers = Array.isArray(this.authProvider)
          ? this.authProvider
          : this.authProvider
            ? this.authProvider.split(",").map((provider) => provider.trim())
            : [];
        return providers.includes("local");
      },
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "operator", "admin"],
      required: [true, "Role is required"],
      default: "user",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    hasRegisteredBus: {
      type: Boolean,
      default: false,
    },
    travelCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelCompany",
    },
    buses: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Bus",
      default: [],
    },
    operatorApprovalStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "operator_requested",
        "company_requested",
        "approved",
        "rejected",
      ],
      default: "none",
    },
    pendingTravelCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelCompany",
    },
    invitedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },

    securityCode: {
      type: String,
    },

    securityCodeExpiry: {
      type: Date,
    },

    adminAccessCode: {
      type: String,
    },

    adminAccessCodeExpiry: {
      type: Date,
    },

    accessToken: {
      type: String,
    },

    accessTokenExpiry: {
      type: Date,
    },

    verifyToken: {
      type: String,
    },

    verifyTokenExpiry: {
      type: Date,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    couponUsageStats: {
      type: [
        {
          couponId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Coupon",
            required: true,
          },
          couponCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
          },
          uses: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
          },
          lastUsedAt: {
            type: Date,
            default: null,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.pre("save", function syncAdminRole() {
  if (this.isSuperAdmin) {
    this.role = "admin";
  }

  if (this.role === "admin" && !this.isSuperAdmin) {
    this.hasRegisteredBus = Array.isArray(this.buses) && this.buses.length > 0;
  } else {
    this.hasRegisteredBus = true;
  }

  if (this.role !== "operator") {
    this.operatorApprovalStatus = "none";
    this.pendingTravelCompanyId = undefined;
    this.invitedByAdminId = undefined;
  }

  if (this.role === "operator") {
    if (this.operatorApprovalStatus === "approved" && this.pendingTravelCompanyId) {
      this.pendingTravelCompanyId = undefined;
    }
    if (this.operatorApprovalStatus === "none") {
      this.pendingTravelCompanyId = undefined;
    }
  }
});

// In Next.js dev/HMR, Mongoose may keep an older compiled schema in memory.
// Replacing the model avoids stale enum validation (e.g. missing "admin" role).
if (process.env.NODE_ENV !== "production" && mongoose.models.users) {
  delete mongoose.models.users;
}
if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.models.users || mongoose.model("users", userSchema, "users");

// Keep both model names registered because existing refs use both "users" and "User".
if (!mongoose.models.User) {
  mongoose.model("User", userSchema, "users");
}

export default User;
