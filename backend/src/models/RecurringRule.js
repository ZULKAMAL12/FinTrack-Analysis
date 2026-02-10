import mongoose from "mongoose";

const RecurringRuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingsAccount",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be at least 0.01"],
      max: [999999999, "Amount cannot exceed 999,999,999"],
    },

    frequency: {
      type: String,
      default: "monthly",
      enum: {
        values: ["monthly"],
        message: "{VALUE} is not supported (only monthly is supported)",
      },
    },

    dayOfMonth: {
      type: Number,
      default: 5,
      min: [1, "Day of month must be at least 1"],
      max: [28, "Day of month cannot exceed 28 (for safety across all months)"],
    },

    startYear: {
      type: Number,
      required: [true, "Start year is required"],
      min: [2000, "Start year must be 2000 or later"],
      max: [2100, "Start year cannot exceed 2100"],
    },

    startMonth: {
      type: Number,
      required: [true, "Start month is required"],
      min: [1, "Start month must be between 1 and 12"],
      max: [12, "Start month must be between 1 and 12"],
    },

    endYear: {
      type: Number,
      min: [2000, "End year must be 2000 or later"],
      max: [2100, "End year cannot exceed 2100"],
    },

    endMonth: {
      type: Number,
      min: [1, "End month must be between 1 and 12"],
      max: [12, "End month must be between 1 and 12"],
    },

    mode: {
      type: String,
      default: "pending",
      enum: {
        values: ["pending", "auto_confirm"],
        message: "{VALUE} is not a valid mode",
      },
    },

    isActive: { type: Boolean, default: true },

    lastGeneratedAt: { type: Date },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
RecurringRuleSchema.index({ userId: 1, accountId: 1, isActive: 1 });
RecurringRuleSchema.index({ userId: 1, isActive: 1, frequency: 1 });
RecurringRuleSchema.index({ userId: 1, deletedAt: 1 });

// ✅ FIXED: Async pre-validate hook (no next callback)
RecurringRuleSchema.pre("validate", async function () {
  // Validate end date is after start date
  if (this.endYear && this.endMonth) {
    const startDate = this.startYear * 12 + this.startMonth;
    const endDate = this.endYear * 12 + this.endMonth;

    if (endDate < startDate) {
      this.invalidate("endYear", "End date must be after start date");
      this.invalidate("endMonth", "End date must be after start date");
    }
  }

  // If endYear is set, endMonth must also be set (and vice versa)
  if ((this.endYear && !this.endMonth) || (!this.endYear && this.endMonth)) {
    this.invalidate(
      "endYear",
      "Both endYear and endMonth must be set together",
    );
    this.invalidate(
      "endMonth",
      "Both endYear and endMonth must be set together",
    );
  }
});

export default mongoose.model("RecurringRule", RecurringRuleSchema);
