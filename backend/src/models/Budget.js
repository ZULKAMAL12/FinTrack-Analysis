import mongoose from "mongoose";

const BudgetItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BudgetSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },

    /**
     * NEW (recommended): kind = what UI uses to calculate totals
     * - income: money coming in
     * - expense: money going out (includes savings/debt as outflow if user wants)
     */
    kind: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      default: "expense",
      index: true,
    },

    /**
     * OPTIONAL (backward compatibility):
     * If your older data/controller still sends "type"
     * you can keep it to avoid breaking old docs.
     * You can remove this later after migration.
     */
    type: {
      type: String,
      enum: ["income", "expense", "saving", "debt"],
      default: "expense",
      index: true,
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
    month: { type: Number, index: true, required: true, min: 1, max: 12 }, // 1-12
    sections: { type: [BudgetSectionSchema], default: [] },
  },
  { timestamps: true }
);

BudgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", BudgetSchema);
