import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    name: { type: String, trim: true, required: true },
    type: {
      type: String,
      enum: ["cash", "bank", "ewallet", "savings", "investment", "other"],
      default: "bank",
    },
    currency: { type: String, default: "MYR" },
    openingBalance: { type: Number, default: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Account", AccountSchema);
