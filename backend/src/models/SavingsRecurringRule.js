import mongoose from "mongoose";

const savingsRecurringRuleSchema = new mongoose.Schema(
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
      required: true,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ["monthly", "weekly", "daily"],
      default: "monthly",
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28,
      default: 5,
    },
    startYear: {
      type: Number,
      required: true,
    },
    startMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    endYear: {
      type: Number,
      min: 2000,
      max: 2100,
    },
    endMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    mode: {
      type: String,
      enum: ["pending", "auto_confirm"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
savingsRecurringRuleSchema.index({ userId: 1, accountId: 1 });
savingsRecurringRuleSchema.index({ userId: 1, isActive: 1 });

const SavingsRecurringRule = mongoose.model(
  "SavingsRecurringRule",
  savingsRecurringRuleSchema
);

export default SavingsRecurringRule;