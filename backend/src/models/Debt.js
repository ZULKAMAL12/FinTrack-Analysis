import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
  },
  { _id: true }
);

const debtSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "Car Loan",
        "House Loan",
        "Education Loan (PTPTN)",
        "BNPL",
        "Credit Card",
        "Personal Loan",
        "Other",
      ],
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lender: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 999999999,
    },
    currentBalance: {
      type: Number,
      required: true,
      min: 0,
      max: 999999999,
    },
    monthlyPayment: {
      type: Number,
      required: true,
      min: 0.01,
      max: 999999999,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    nextPaymentDate: {
      type: Date,
      required: true,
    },
    paymentHistory: [paymentHistorySchema],
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
debtSchema.index({ userId: 1, category: 1 });
debtSchema.index({ userId: 1, deletedAt: 1 });
debtSchema.index({ userId: 1, nextPaymentDate: 1 });

// Virtual: Progress percentage
debtSchema.virtual("progressPercent").get(function () {
  if (this.originalAmount === 0) return 0;
  const paid = this.originalAmount - this.currentBalance;
  return ((paid / this.originalAmount) * 100).toFixed(2);
});

// Virtual: Total paid
debtSchema.virtual("totalPaid").get(function () {
  return this.originalAmount - this.currentBalance;
});

// Ensure virtuals are included in JSON
debtSchema.set("toJSON", { virtuals: true });
debtSchema.set("toObject", { virtuals: true });

const Debt = mongoose.model("Debt", debtSchema);

export default Debt;