import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["Income", "Expense"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 999999999,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Credit Card", "Debit Card", "E-wallet", "Bank Transfer", "Other"],
      default: "Cash",
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    dateISO: {
      type: Date,
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

// Compound indexes for efficient queries
expenseSchema.index({ userId: 1, year: 1, month: 1 });
expenseSchema.index({ userId: 1, type: 1, year: 1, month: 1 });
expenseSchema.index({ userId: 1, category: 1, year: 1, month: 1 });
expenseSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
expenseSchema.index({ userId: 1, paymentMethod: 1, year: 1, month: 1 });

// Pre-save: Auto-generate dateISO from year/month/day
expenseSchema.pre("save", function () {
  if (this.year && this.month && this.day) {
    this.dateISO = new Date(this.year, this.month - 1, this.day);
  }
});

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;