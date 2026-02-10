import mongoose from "mongoose";

const InvestmentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestmentAsset",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: {
        values: ["buy", "sell", "dividend"],
        message: "{VALUE} is not a valid transaction type",
      },
      index: true,
    },

    units: {
      type: Number,
      required: [true, "Units is required"],
      min: [0.00000001, "Units must be at least 0.00000001"],
      max: [999999999, "Units cannot exceed 999,999,999"],
    },

    pricePerUnit: {
      type: Number,
      required: [true, "Price per unit is required"],
      min: [0.01, "Price per unit must be at least 0.01"],
      max: [999999999, "Price per unit cannot exceed 999,999,999"],
    },

    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0.01, "Total amount must be at least 0.01"],
      max: [9999999999, "Total amount cannot exceed 9,999,999,999"],
    },

    currency: {
      type: String,
      default: "USD",
      enum: {
        values: ["USD", "MYR"],
        message: "{VALUE} is not supported",
      },
    },

    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [2000, "Year must be 2000 or later"],
      max: [2100, "Year cannot exceed 2100"],
      index: true,
    },

    month: {
      type: Number,
      required: [true, "Month is required"],
      min: [1, "Month must be between 1 and 12"],
      max: [12, "Month must be between 1 and 12"],
      index: true,
    },

    day: {
      type: Number,
      min: [1, "Day must be at least 1"],
      max: [31, "Day cannot exceed 31"],
    },

    dateISO: {
      type: Date,
    },

    notes: {
      type: String,
      default: "",
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    // Store asset symbol/name for display (denormalized for performance)
    assetSymbol: {
      type: String,
      index: true,
    },

    assetName: {
      type: String,
    },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
InvestmentTransactionSchema.index({ userId: 1, year: -1, month: -1 });
InvestmentTransactionSchema.index({ userId: 1, assetId: 1, createdAt: -1 });
InvestmentTransactionSchema.index({ userId: 1, type: 1 });
InvestmentTransactionSchema.index({
  userId: 1,
  assetId: 1,
  year: -1,
  month: -1,
  day: -1,
});

// Auto-generate dateISO if not provided
InvestmentTransactionSchema.pre("save", async function () {
  if (!this.dateISO && this.year && this.month) {
    const day = this.day || 1;
    this.dateISO = new Date(Date.UTC(this.year, this.month - 1, day, 0, 0, 0));
  }
});

export default mongoose.model(
  "InvestmentTransaction",
  InvestmentTransactionSchema,
);
