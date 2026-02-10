import mongoose from "mongoose";

const SavingsTransactionSchema = new mongoose.Schema(
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

    type: {
      type: String,
      required: true,
      enum: {
        values: ["capital_add", "dividend", "withdrawal"],
        message: "{VALUE} is not a valid transaction type",
      },
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be at least 0.01"],
      max: [999999999, "Amount cannot exceed 999,999,999"],
    },

    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [2000, "Year must be 2000 or later"],
      max: [2100, "Year cannot exceed 2100"],
    },

    month: {
      type: Number,
      required: [true, "Month is required"],
      min: [1, "Month must be between 1 and 12"],
      max: [12, "Month must be between 1 and 12"],
    },

    day: {
      type: Number,
      min: [1, "Day must be at least 1"],
      max: [31, "Day cannot exceed 31"],
    },

    dateISO: { type: Date },

    status: {
      type: String,
      default: "completed",
      enum: {
        values: ["pending", "completed"],
        message: "{VALUE} is not a valid status",
      },
      index: true,
    },

    source: {
      type: String,
      default: "manual",
      enum: {
        values: ["manual", "recurring"],
        message: "{VALUE} is not a valid source",
      },
      index: true,
    },

    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringRule",
    },

    notes: {
      type: String,
      default: "",
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
SavingsTransactionSchema.index({ userId: 1, status: 1 });
SavingsTransactionSchema.index({ userId: 1, year: 1, status: 1 });
SavingsTransactionSchema.index({ userId: 1, accountId: 1, year: 1, month: 1 });
SavingsTransactionSchema.index({
  userId: 1,
  accountId: 1,
  year: -1,
  month: -1,
  day: -1,
});

// Prevent duplicate recurring deposit generation per month (idempotent)
SavingsTransactionSchema.index(
  { userId: 1, accountId: 1, ruleId: 1, year: 1, month: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: "recurring",
      type: "capital_add",
      ruleId: { $exists: true },
    },
    name: "unique_recurring_monthly_deposit",
  },
);

// ✅ FIXED: Async pre-validate hook (no next callback)
SavingsTransactionSchema.pre("validate", async function () {
  if (this.day && this.year && this.month) {
    const maxDay = new Date(this.year, this.month, 0).getDate();
    if (this.day > maxDay) {
      this.invalidate(
        "day",
        `Day ${this.day} is invalid for ${this.month}/${this.year} (max: ${maxDay})`,
      );
    }
  }
});

// ✅ FIXED: Async pre-save hook (no next callback)
SavingsTransactionSchema.pre("save", async function () {
  if (!this.dateISO && this.year && this.month) {
    const day = this.day || 1;
    this.dateISO = new Date(Date.UTC(this.year, this.month - 1, day, 0, 0, 0));
  }
});

export default mongoose.model("SavingsTransaction", SavingsTransactionSchema);
