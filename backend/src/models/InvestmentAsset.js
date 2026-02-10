import mongoose from "mongoose";

const InvestmentAssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Asset name is required"],
      trim: true,
      minlength: [1, "Asset name must be at least 1 character"],
      maxlength: [100, "Asset name cannot exceed 100 characters"],
    },

    symbol: {
      type: String,
      required: [true, "Symbol is required"],
      trim: true,
      uppercase: true,
      minlength: [1, "Symbol must be at least 1 character"],
      maxlength: [20, "Symbol cannot exceed 20 characters"],
      index: true,
    },

    type: {
      type: String,
      required: [true, "Asset type is required"],
      enum: {
        values: ["stock", "etf", "crypto", "gold"],
        message: "{VALUE} is not a valid asset type",
      },
      index: true,
    },

    exchange: {
      type: String,
      required: [true, "Exchange is required"],
      enum: {
        values: ["US", "KLSE", "CRYPTO", "COMMODITY"],
        message: "{VALUE} is not a valid exchange",
      },
      default: "US",
    },

    currency: {
      type: String,
      required: [true, "Currency is required"],
      enum: {
        values: ["USD", "MYR"],
        message: "{VALUE} is not supported (only USD and MYR)",
      },
      default: "USD",
    },

    // Computed fields (updated by transactions)
    totalUnits: {
      type: Number,
      default: 0,
      min: [0, "Total units cannot be negative"],
    },

    totalInvested: {
      type: Number,
      default: 0,
      min: [0, "Total invested cannot be negative"],
    },

    lastKnownPrice: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },

    lastPriceUpdate: {
      type: Date,
    },

    color: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^#[0-9a-fA-F]{6}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid hex color!`,
      },
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
InvestmentAssetSchema.index({ userId: 1, type: 1 });
InvestmentAssetSchema.index({ userId: 1, symbol: 1 });
InvestmentAssetSchema.index({ userId: 1, deletedAt: 1 });
InvestmentAssetSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate symbols per user
InvestmentAssetSchema.index(
  { userId: 1, symbol: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: "unique_user_symbol",
  },
);

export default mongoose.model("InvestmentAsset", InvestmentAssetSchema);
