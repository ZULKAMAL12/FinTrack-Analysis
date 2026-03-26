import mongoose from "mongoose";

const savingsTransactionSchema = new mongoose.Schema(
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
      enum: ["capital_add", "dividend", "withdrawal"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    day: {
      type: Number,
      min: 1,
      max: 31,
    },
    dateISO: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
    },
    source: {
      type: String,
      enum: ["manual", "recurring"],
      default: "manual",
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
savingsTransactionSchema.index({ userId: 1, year: -1, month: -1 });
savingsTransactionSchema.index({ userId: 1, accountId: 1 });
savingsTransactionSchema.index({ userId: 1, status: 1 });
savingsTransactionSchema.index({ accountId: 1, status: 1 });

const SavingsTransaction = mongoose.model(
  "SavingsTransaction",
  savingsTransactionSchema
);

export default SavingsTransaction;
