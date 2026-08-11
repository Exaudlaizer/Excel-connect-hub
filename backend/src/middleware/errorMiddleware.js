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

  // Genuine server faults are worth a log line; client mistakes are not.
  if (status >= 500) console.error(error);

  res.status(status).json({
    message: translated?.message || error.message || "Server error",
    ...(translated?.errors ? { errors: translated.errors } : {}),
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}

module.exports = { notFound, errorHandler };
