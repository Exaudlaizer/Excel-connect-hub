function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

// Sequelize surfaces bad input as exceptions. Left untranslated they all become
// 500s, so a mistyped enum value or a duplicate email reads as "the server is
// broken" instead of "fix your request".
function translate(error) {
  switch (error.name) {
    case "SequelizeValidationError":
      return {
        status: 400,
        message: "Validation failed",
        errors: error.errors?.map((item) => ({ field: item.path, message: item.message }))
      };
    case "SequelizeUniqueConstraintError":
      return { status: 409, message: "That value is already taken" };
    case "SequelizeForeignKeyConstraintError":
      return { status: 400, message: "Referenced record does not exist" };
    case "SequelizeDatabaseError":
      // Typically an invalid enum value or malformed UUID coming from a query
      // string. The driver message names internal columns, so it is not echoed.
      return { status: 400, message: "Invalid request parameters" };
    default:
      return null;
  }
}

function errorHandler(error, _req, res, _next) {
  const translated = translate(error);
  const fallback = res.statusCode === 200 ? 500 : res.statusCode;
  const status = translated?.status || error.status || fallback;
  const isServerFault = status >= 500;

  // Genuine server faults are worth a log line; client mistakes are not.
  if (isServerFault) console.error(error);

  // A 500 means something inside the server broke. Its message names internal
  // modules, columns, and connection strings, so the client gets a fixed
  // sentence and the detail stays in the server log where it belongs.
  const message = isServerFault
    ? "Something went wrong on our side. Please try again."
    : translated?.message || error.message || "Request failed";

  res.status(status).json({
    message,
    ...(translated?.errors ? { errors: translated.errors } : {}),
    // Never in production, and never for a client error where it adds nothing.
    ...(process.env.NODE_ENV !== "production" && isServerFault ? { stack: error.stack } : {})
  });
}

module.exports = { notFound, errorHandler };
