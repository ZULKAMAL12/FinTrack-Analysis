import Joi from "joi";

// Custom validator for hex color
const hexColor = Joi.string().regex(/^#[0-9a-fA-F]{6}$/);

export const validateCreateAccount = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
      "string.empty": "Account name cannot be empty",
      "string.max": "Account name cannot exceed 100 characters",
      "any.required": "Account name is required",
    }),
    color: hexColor.default("#0ea5e9"),
    goal: Joi.number().min(0).max(999999999).default(0),
    startingBalance: Joi.number().min(0).max(999999999).default(0),
    ratePercent: Joi.number().min(0).max(100).default(0),
    returnFrequency: Joi.string()
      .valid("daily_working", "daily_calendar", "weekly", "monthly", "yearly")
      .default("daily_working"),
    monthlyContribution: Joi.number().min(0).max(999999999).default(0),
    autoDepositReminder: Joi.boolean().default(false),
  }).options({ stripUnknown: true }); // Remove unknown fields

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
      field: error.details[0].path[0],
    });
  }

  req.validatedBody = value;
  next();
};

export const validateUpdateAccount = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100),
    color: hexColor,
    goal: Joi.number().min(0).max(999999999),
    startingBalance: Joi.number().min(0).max(999999999),
    ratePercent: Joi.number().min(0).max(100),
    returnFrequency: Joi.string().valid(
      "daily_working",
      "daily_calendar",
      "weekly",
      "monthly",
      "yearly",
    ),
    monthlyContribution: Joi.number().min(0).max(999999999),
    autoDepositReminder: Joi.boolean(),
  })
    .options({ stripUnknown: true })
    .min(1); // At least one field required

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
      field: error.details[0].path[0],
    });
  }

  req.validatedBody = value;
  next();
};

export const validateCreateTransaction = (req, res, next) => {
  const schema = Joi.object({
    accountId: Joi.string().required().messages({
      "any.required": "Account ID is required",
    }),
    type: Joi.string()
      .valid("capital_add", "dividend", "withdrawal")
      .required()
      .messages({
        "any.only":
          "Transaction type must be capital_add, dividend, or withdrawal",
        "any.required": "Transaction type is required",
      }),
    amount: Joi.number()
      .min(0.01)
      .max(999999999)
      .precision(2)
      .required()
      .messages({
        "number.min": "Amount must be at least 0.01",
        "number.max": "Amount cannot exceed 999,999,999",
        "number.precision": "Amount can have at most 2 decimal places",
        "any.required": "Amount is required",
      }),
    year: Joi.number().integer().min(2000).max(2100).required(),
    month: Joi.number().integer().min(1).max(12).required(),
    day: Joi.number().integer().min(1).max(31).optional(),
    notes: Joi.string().max(500).allow("").default(""),
    status: Joi.string().valid("completed", "pending").default("completed"),
    source: Joi.string().valid("manual", "recurring").default("manual"),
  }).options({ stripUnknown: true });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
      field: error.details[0].path[0],
    });
  }

  // Validate day is valid for month
  if (value.day) {
    const maxDay = new Date(value.year, value.month, 0).getDate();
    if (value.day > maxDay) {
      return res.status(400).json({
        message: `Day ${value.day} is invalid for month ${value.month}/${value.year} (max: ${maxDay})`,
        field: "day",
      });
    }
  }

  req.validatedBody = value;
  next();
};

export const validateCreateRule = (req, res, next) => {
  const schema = Joi.object({
    accountId: Joi.string().required(),
    amount: Joi.number().min(0.01).max(999999999).precision(2).required(),
    frequency: Joi.string().valid("monthly").default("monthly"),
    dayOfMonth: Joi.number().integer().min(1).max(28).default(5),
    startYear: Joi.number().integer().min(2000).max(2100).required(),
    startMonth: Joi.number().integer().min(1).max(12).required(),
    endYear: Joi.number().integer().min(2000).max(2100).optional(),
    endMonth: Joi.number().integer().min(1).max(12).optional(),
    mode: Joi.string().valid("pending", "auto_confirm").default("pending"),
    isActive: Joi.boolean().default(true),
  }).options({ stripUnknown: true });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
      field: error.details[0].path[0],
    });
  }

  // Validate end date if provided
  if (value.endYear && value.endMonth) {
    const startDate = value.startYear * 12 + value.startMonth;
    const endDate = value.endYear * 12 + value.endMonth;

    if (endDate < startDate) {
      return res.status(400).json({
        message: "End date must be after start date",
        field: "endYear",
      });
    }
  }

  // Both or neither
  if (
    (value.endYear && !value.endMonth) ||
    (!value.endYear && value.endMonth)
  ) {
    return res.status(400).json({
      message: "Both endYear and endMonth must be provided together",
      field: "endYear",
    });
  }

  req.validatedBody = value;
  next();
};
export const validateListTransactions = (req, res, next) => {
  const schema = Joi.object({
    year: Joi.number().integer().min(2000).max(2100).required(),
    month: Joi.number().integer().min(1).max(12).optional(),
    accountId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
  });

  const { error, value } = schema.validate(req.query);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  req.validatedQuery = value;
  next();
};

export const validatePatchTransaction = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid("pending", "completed").optional(),
    notes: Joi.string().max(500).optional(),
  }).min(1); // At least one field required

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  req.validatedBody = value;
  next();
};
