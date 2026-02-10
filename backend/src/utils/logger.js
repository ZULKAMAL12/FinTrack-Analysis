import winston from "winston";

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "savings-service" },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760,
      maxFiles: 5,
    }),
    // Write audit logs separately
    new winston.transports.File({
      filename: "logs/audit.log",
      level: "info",
      maxsize: 10485760,
      maxFiles: 10, // Keep more audit logs
    }),
  ],
});

export default logger;
