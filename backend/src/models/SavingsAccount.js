import mongoose from "mongoose";

const savingsAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    color: {
      type: String,
      default: "#0ea5e9",
      match: /^#([0-9a-fA-F]{6})$/,
    },
    goal: {
      type: Number,
      default: 0,
      min: 0,
    },
    startingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    returnFrequency: {
      type: String,
      enum: ["daily_working", "daily_calendar", "weekly", "monthly", "yearly"],
      default: "monthly",
    },
    monthlyContribution: {
      type: Number,
      default: 0,
      min: 0,
    },
    autoDepositReminder: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
savingsAccountSchema.index({ userId: 1, createdAt: -1 });

const SavingsAccount = mongoose.model("SavingsAccount", savingsAccountSchema);

export default SavingsAccount;