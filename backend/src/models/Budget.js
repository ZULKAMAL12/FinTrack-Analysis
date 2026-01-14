import mongoose from "mongoose";

const BudgetItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BudgetSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["income", "expense", "saving", "debt"],
      required: true,
    },
    items: { type: [BudgetItemSchema], default: [] },
  },
  { _id: false }
);

const BudgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    year: { type: Number, index: true, required: true },
    month: { type: Number, index: true, required: true }, // 1-12
    sections: { type: [BudgetSectionSchema], default: [] },
  },
  { timestamps: true }
);

BudgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", BudgetSchema);
