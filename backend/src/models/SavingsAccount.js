import mongoose from "mongoose";

const SavingsAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
      minlength: [1, "Account name must be at least 1 character"],
      maxlength: [100, "Account name cannot exceed 100 characters"],
    },

    color: {
      type: String,
      default: "#0ea5e9",
      validate: {
        validator: function (v) {
          return /^#[0-9a-fA-F]{6}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid hex color!`,
      },
    },

    goal: {
      type: Number,
      default: 0,
      min: [0, "Goal cannot be negative"],
      max: [999999999, "Goal cannot exceed 999,999,999"],
    },

    startingBalance: {
      type: Number,
      default: 0,
      min: [0, "Starting balance cannot be negative"],
      max: [999999999, "Starting balance cannot exceed 999,999,999"],
    },

    ratePercent: {
      type: Number,
      default: 0,
      min: [0, "Rate cannot be negative"],
      max: [100, "Rate cannot exceed 100%"],
    },

    returnFrequency: {
      type: String,
      default: "daily_working",
      enum: {
        values: [
          "daily_working",
          "daily_calendar",
          "weekly",
          "monthly",
          "yearly",
        ],
        message: "{VALUE} is not a valid return frequency",
      },
    },

    monthlyContribution: {
      type: Number,
      default: 0,
      min: [0, "Monthly contribution cannot be negative"],
      max: [999999999, "Monthly contribution cannot exceed 999,999,999"],
    },

    autoDepositReminder: { type: Boolean, default: false },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
SavingsAccountSchema.index({ userId: 1, createdAt: -1 });
SavingsAccountSchema.index({ userId: 1, deletedAt: 1 });

export default mongoose.model("SavingsAccount", SavingsAccountSchema);
