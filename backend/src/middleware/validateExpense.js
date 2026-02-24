import Joi from "joi";

/**
 * Validate create expense
 */
export function validateCreateExpense(req, res, next) {
  const schema = Joi.object({
    type: Joi.string().valid("Income", "Expense").required(),
    category: Joi.string().trim().min(1).max(50).required(),
    amount: Joi.number().min(0.01).max(999999999).required(),
    note: Joi.string().trim().max(500).allow("").default(""),
    paymentMethod: Joi.string()
      .valid("Cash", "Credit Card", "Debit Card", "E-wallet", "Bank Transfer", "Other")
      .default("Cash"),
    year: Joi.number().integer().min(2000).max(2100).required(),
    month: Joi.number().integer().min(1).max(12).required(),
    day: Joi.number().integer().min(1).max(31).required(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }

  req.body = value;
  next();
}

/**
 * Validate update expense
 */
export function validateUpdateExpense(req, res, next) {
  const schema = Joi.object({
    type: Joi.string().valid("Income", "Expense"),
    category: Joi.string().trim().min(1).max(50),
    amount: Joi.number().min(0.01).max(999999999),
    note: Joi.string().trim().max(500).allow(""),
    paymentMethod: Joi.string().valid(
      "Cash",
      "Credit Card",
      "Debit Card",
      "E-wallet",
      "Bank Transfer",
      "Other"
    ),
    year: Joi.number().integer().min(2000).max(2100),
    month: Joi.number().integer().min(1).max(12),
    day: Joi.number().integer().min(1).max(31),
  }).min(1);

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }

  req.body = value;
  next();
}