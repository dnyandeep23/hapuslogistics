
import mongoose, { Schema, Document, models } from 'mongoose';

export interface IBusOffice {
  officeName: string;
  address?: string;
  city: string;
  state: string;
  zip?: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  geoPoint?: {
    type?: "Point";
    coordinates?: number[];
  };
}

export interface IBus extends Document {
  travelCompanyId: mongoose.Types.ObjectId;
  busName: string;
  busNumber: string;
  busImages: string[];
  contactPersonName?: string;
  contactPersonNumber?: string;
  capacity: number;
  autoRenewCapacity: boolean;
  operatorContactPeriods: {
    operatorId: mongoose.Types.ObjectId;
    operatorName: string;
    operatorPhone: string;
    startDate: Date;
    endDate: Date;
    assignedAt: Date;
  }[];
  offices: IBusOffice[];
  availability: {
    date: Date;
    totalCapacityKg: number;
    availableCapacityKg: number;
  }[];
  pricing: {
    sequence?: number;
    pickupLocation: mongoose.Types.ObjectId;
    dropLocation: mongoose.Types.ObjectId;
    pickupCategory?: string;
    dropCategory?: string;
    priceRatio?: number;
    distanceKm?: number;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
    pickupTime?: string;
    dropTime?: string;
    fares: Record<string, number>;
    dateOverrides?: {
      date: Date;
      fares: Record<string, number>;
    }[];
  }[];
  routePath: {
    sequence: number;
    location: mongoose.Types.ObjectId;
    pointCategory: "pickup" | "drop";
    pointTime: string;
    distanceToNextKm?: number;
    durationToNextMinutes?: number;
  }[];
  routeSummary?: {
    totalDistanceKm?: number;
    totalDurationMinutes?: number;
  };
  sessions: mongoose.Types.ObjectId[];
}

const BusSchema: Schema<IBus> = new Schema({
  travelCompanyId: {
    type: Schema.Types.ObjectId,
    ref: 'TravelCompany',
    required: true,
  },
  busName: {
    type: String,
    required: true,
  },
  busNumber: {
    type: String,
    required: true,
  },
  busImages: {
    type: [String],
    required: true,
    validate: {
      validator: (value: string[]) => Array.isArray(value) && value.length > 0,
      message: "At least one bus image is required.",
    },
  },
  offices: {
    type: [
      {
        officeName: {
          type: String,
          required: true,
          trim: true,
        },
        address: {
          type: String,
          default: "",
          trim: true,
        },
        city: {
          type: String,
          required: true,
          trim: true,
        },
        state: {
          type: String,
          required: true,
          trim: true,
        },
        zip: {
          type: String,
          default: "",
          trim: true,
        },
        phone: {
          type: String,
          required: true,
          trim: true,
        },
        latitude: {
          type: Number,
          default: null,
        },
        longitude: {
          type: Number,
          default: null,
        },
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
      },
    ],
    default: [],
    validate: {
      validator: (value: IBusOffice[]) =>
        Array.isArray(value) &&
        value.length >= 1 &&
        value.every(
          (office) =>
            Boolean(office?.officeName?.trim()) &&
            Boolean(office?.city?.trim()) &&
            Boolean(office?.state?.trim()) &&
            Boolean(office?.phone?.trim()),
        ),
      message: "At least 1 bus office is required.",
    },
  },
  contactPersonName: {
    type: String,
  },
  contactPersonNumber: {
    type: String,
  },
  operatorContactPeriods: {
    type: [
      {
        operatorId: {
          type: Schema.Types.ObjectId,
          ref: "users",
          required: true,
        },
        operatorName: {
          type: String,
          required: true,
        },
        operatorPhone: {
          type: String,
          default: "",
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
  },
  capacity: {
    type: Number,
    required: true,
  },
  autoRenewCapacity: {
    type: Boolean,
    default: false,
  },
  availability: [
    {
      date: { type: Date, required: true },
      totalCapacityKg: { type: Number, required: true },
      availableCapacityKg: { type: Number, required: true },
    },
  ],
  pricing: [
    {
      sequence: {
        type: Number,
        default: 1,
      },
      pickupLocation: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
      },
      dropLocation: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
      },
      pickupCategory: {
        type: String,
        default: "",
      },
      dropCategory: {
        type: String,
        default: "",
      },
      priceRatio: {
        type: Number,
        default: 100,
      },
      distanceKm: {
        type: Number,
        default: 0,
        min: 0,
      },
      effectiveStartDate: {
        type: Date,
      },
      effectiveEndDate: {
        type: Date,
      },
      pickupTime: {
        type: String,
      },
      dropTime: {
        type: String,
      },
      fares: {
        type: Map,
        of: Number,
        required: true,
      },
      dateOverrides: [
        {
          date: { type: Date, required: true },
          fares: {
            type: Map,
            of: Number,
            required: true,
          },
        },
      ],
    },
  ],
  routePath: [
    {
      sequence: {
        type: Number,
        required: true,
        min: 1,
      },
      location: {
        type: Schema.Types.ObjectId,
        ref: "Location",
        required: true,
      },
      pointCategory: {
        type: String,
        enum: ["pickup", "drop"],
        default: "drop",
      },
      pointTime: {
        type: String,
        required: true,
      },
      distanceToNextKm: {
        type: Number,
        default: 0,
        min: 0,
      },
      durationToNextMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  ],
  routeSummary: {
    totalDistanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  sessions: [{
    type: Schema.Types.ObjectId,
    ref: 'BookingSession'
  }]
});

BusSchema.pre("validate", function syncOfficeGeoPoints() {
  const offices = Array.isArray(this.get("offices")) ? this.get("offices") : [];
  const normalizedOffices = offices.map((office: IBusOffice) => {
    const latitude = Number(office?.latitude);
    const longitude = Number(office?.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        ...office,
        latitude,
        longitude,
        geoPoint: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      };
    }

    return {
      ...office,
      latitude: null,
      longitude: null,
      geoPoint: undefined,
    };
  });

  this.set("offices", normalizedOffices);
});

// This line ensures that if the model is already in the cache, we use that instance
// This is important for Next.js's hot-reloading feature
if (models.Bus) {
  delete (models as { Bus?: unknown }).Bus;
}

const Bus = mongoose.model<IBus>('Bus', BusSchema);

export default Bus;
