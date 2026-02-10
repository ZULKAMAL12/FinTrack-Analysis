import Joi from "joi";

/**
 * Validate create asset request
 */
export const validateCreateAsset = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
      "string.empty": "Asset name is required",
      "string.min": "Asset name must be at least 1 character",
      "string.max": "Asset name cannot exceed 100 characters",
      "any.required": "Asset name is required",
    }),

    symbol: Joi.string().trim().uppercase().min(1).max(20).required().messages({
      "string.empty": "Symbol is required",
      "string.min": "Symbol must be at least 1 character",
      "string.max": "Symbol cannot exceed 20 characters",
      "any.required": "Symbol is required",
    }),

    type: Joi.string()
      .valid("stock", "etf", "crypto", "gold")
      .required()
      .messages({
        "any.only": "Type must be stock, etf, crypto, or gold",
        "any.required": "Asset type is required",
      }),

    exchange: Joi.string()
      .valid("US", "KLSE", "CRYPTO", "COMMODITY")
      .default("US")
      .messages({
        "any.only": "Exchange must be US, KLSE, CRYPTO, or COMMODITY",
      }),

    currency: Joi.string().valid("USD", "MYR").default("USD").messages({
      "any.only": "Currency must be USD or MYR",
    }),

    color: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Color must be a valid hex color (e.g., #0ea5e9)",
      }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  req.validatedBody = value;
  next();
};

/**
 * Validate update asset request
 */
export const validateUpdateAsset = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).optional().messages({
      "string.min": "Asset name must be at least 1 character",
      "string.max": "Asset name cannot exceed 100 characters",
    }),

    color: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .messages({
        "string.pattern.base": "Color must be a valid hex color",
      }),
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

/**
 * Validate create transaction request
 */
export const validateCreateTransaction = (req, res, next) => {
  const schema = Joi.object({
    assetId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid asset ID format",
        "any.required": "Asset ID is required",
      }),

    type: Joi.string().valid("buy", "sell", "dividend").required().messages({
      "any.only": "Type must be buy, sell, or dividend",
      "any.required": "Transaction type is required",
    }),

    units: Joi.number()
      .positive()
      .min(0.00000001)
      .max(999999999)
      .precision(8)
      .required()
      .messages({
        "number.base": "Units must be a number",
        "number.positive": "Units must be positive",
        "number.min": "Units must be at least 0.00000001",
        "number.max": "Units cannot exceed 999,999,999",
        "any.required": "Units is required",
      }),

    pricePerUnit: Joi.number()
      .positive()
      .min(0.01)
      .max(999999999)
      .precision(2)
      .required()
      .messages({
        "number.base": "Price per unit must be a number",
        "number.positive": "Price per unit must be positive",
        "number.min": "Price per unit must be at least 0.01",
        "number.max": "Price per unit cannot exceed 999,999,999",
        "any.required": "Price per unit is required",
      }),

    totalAmount: Joi.number()
      .positive()
      .min(0.01)
      .max(9999999999)
      .required()
      .messages({
        "number.base": "Total amount must be a number",
        "number.positive": "Total amount must be positive",
        "number.min": "Total amount must be at least 0.01",
        "number.max": "Total amount cannot exceed 9,999,999,999",
        "any.required": "Total amount is required",
      }),

    year: Joi.number().integer().min(2000).max(2100).required().messages({
      "number.base": "Year must be a number",
      "number.integer": "Year must be an integer",
      "number.min": "Year must be 2000 or later",
      "number.max": "Year cannot exceed 2100",
      "any.required": "Year is required",
    }),

    month: Joi.number().integer().min(1).max(12).required().messages({
      "number.base": "Month must be a number",
      "number.integer": "Month must be an integer",
      "number.min": "Month must be between 1 and 12",
      "number.max": "Month must be between 1 and 12",
      "any.required": "Month is required",
    }),

    day: Joi.number().integer().min(1).max(31).optional().messages({
      "number.base": "Day must be a number",
      "number.integer": "Day must be an integer",
      "number.min": "Day must be at least 1",
      "number.max": "Day cannot exceed 31",
    }),

    notes: Joi.string().max(500).optional().allow("").messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  // Validate that totalAmount matches units * pricePerUnit
  const calculatedTotal = value.units * value.pricePerUnit;
  const difference = Math.abs(calculatedTotal - value.totalAmount);

  if (difference > 0.01) {
    // Allow 1 cent rounding difference
    return res.status(400).json({
      message: "Total amount must equal units × price per unit",
    });
  }

  // Validate day is valid for the given month/year
  if (value.day) {
    const maxDay = new Date(value.year, value.month, 0).getDate();
    if (value.day > maxDay) {
      return res.status(400).json({
        message: `Day ${value.day} is invalid for ${value.month}/${value.year} (max: ${maxDay})`,
      });
    }
  }

  req.validatedBody = value;
  next();
};

/**
 * Validate update transaction request
 */
export const validateUpdateTransaction = (req, res, next) => {
  const schema = Joi.object({
    notes: Joi.string().max(500).optional().allow("").messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
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

/**
 * Validate get prices request
 */
export const validateGetPrices = (req, res, next) => {
  const schema = Joi.object({
    assets: Joi.array()
      .items(
        Joi.object({
          symbol: Joi.string().required(),
          type: Joi.string().valid("stock", "etf", "crypto", "gold").required(),
          exchange: Joi.string()
            .valid("US", "KLSE", "CRYPTO", "COMMODITY")
            .optional(),
        }),
      )
      .min(1)
      .max(50) // Limit to 50 assets per request
      .required()
      .messages({
        "array.base": "Assets must be an array",
        "array.min": "At least one asset is required",
        "array.max": "Cannot fetch prices for more than 50 assets at once",
        "any.required": "Assets array is required",
      }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  req.validatedBody = value;
  next();
};
