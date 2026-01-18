import mongoose from "mongoose";

const TxSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["deposit", "withdraw", "dividend", "auto", "adjust"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const SavingsAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#0ea5e9" },

    goal: { type: Number, default: 0, min: 0 },

    autoSave: { type: Boolean, default: false },
    autoAmount: { type: Number, default: 0, min: 0 },

    // user inputs for "already have RM 10k" + return rate
    initialCapital: { type: Number, default: 0, min: 0 },
    ratePercent: { type: Number, default: 0, min: 0 }, // % per year
    returnFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: "daily",
    },
    monthlyContribution: { type: Number, default: 0, min: 0 },

    // actual tracked totals
    capital: { type: Number, default: 0, min: 0 },
    dividend: { type: Number, default: 0, min: 0 },

    history: { type: [TxSchema], default: [] },
  },
  { timestamps: true }
);

SavingsAccountSchema.index({ userId: 1, name: 1 });

export default mongoose.model("SavingsAccount", SavingsAccountSchema);
