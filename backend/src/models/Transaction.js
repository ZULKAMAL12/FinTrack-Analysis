import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },

    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, trim: true, required: true },
    amount: { type: Number, required: true }, // positive number
    date: { type: Date, required: true },

    description: { type: String, default: "" },

    year: { type: Number, index: true, required: true },
    month: { type: Number, index: true, required: true }, // 1-12
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, year: 1, month: 1 });

export default mongoose.model("Transaction", TransactionSchema);
