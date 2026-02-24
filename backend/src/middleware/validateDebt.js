import Joi from "joi";

/**
 * Validate create debt
 */
export function validateCreateDebt(req, res, next) {
  const schema = Joi.object({
    category: Joi.string()
      .valid(
        "Car Loan",
        "House Loan",
        "Education Loan (PTPTN)",
        "BNPL",
        "Credit Card",
        "Personal Loan",
        "Other"
      )
      .required(),
    type: Joi.string().trim().min(1).max(100).required(),
    lender: Joi.string().trim().min(1).max(100).required(),
    originalAmount: Joi.number().min(0.01).max(999999999).required(),
    currentBalance: Joi.number().min(0).max(999999999).required(),
    monthlyPayment: Joi.number().min(0.01).max(999999999).required(),
    interestRate: Joi.number().min(0).max(100).required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref("startDate")).required(),
    nextPaymentDate: Joi.date().required(),
    notes: Joi.string().trim().max(1000).allow("").default(""),
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
 * Validate update debt
 */
export function validateUpdateDebt(req, res, next) {
  const schema = Joi.object({
    category: Joi.string().valid(
      "Car Loan",
      "House Loan",
      "Education Loan (PTPTN)",
      "BNPL",
      "Credit Card",
      "Personal Loan",
      "Other"
    ),
    type: Joi.string().trim().min(1).max(100),
    lender: Joi.string().trim().min(1).max(100),
    originalAmount: Joi.number().min(0.01).max(999999999),
    currentBalance: Joi.number().min(0).max(999999999),
    monthlyPayment: Joi.number().min(0.01).max(999999999),
    interestRate: Joi.number().min(0).max(100),
    startDate: Joi.date(),
    endDate: Joi.date(),
    nextPaymentDate: Joi.date(),
    notes: Joi.string().trim().max(1000).allow(""),
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

/**
 * Validate add payment
 */
export function validateAddPayment(req, res, next) {
  const schema = Joi.object({
    amount: Joi.number().min(0.01).max(999999999).required(),
    date: Joi.date().default(() => new Date()),
    note: Joi.string().trim().max(200).allow("").default(""),
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