const { alertOperators } = require("../utils/alerts");
const { captureException } = require("../utils/monitoring");

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

function errorHandler(error, req, res, _next) {
  const translated = translate(error);
  const fallback = res.statusCode === 200 ? 500 : res.statusCode;
  const status = translated?.status || error.status || fallback;
  const isServerFault = status >= 500;

  // Genuine server faults are logged as one JSON line (easy to search and ship),
  // reported if monitoring is on, and may email the operators. Client mistakes
  // are not worth any of that.
  if (isServerFault) {
    const path = String(req.originalUrl || req.url || "").split("?")[0];
    const context = { requestId: req.id, method: req.method, path, status };
    console.error(JSON.stringify({ level: "error", ...context, message: error.message, stack: error.stack }));
    captureException(error, context);
    alertOperators({
      key: "api-5xx",
      subject: "The API returned a server error",
      text: `A request failed with a ${status}.\n\n${req.method} ${path}\nRequest id: ${req.id}\nError: ${String(error.message).slice(0, 300)}\n\nFind the full stack in the server logs under that request id.`
    });
  }

  // A 500 means something inside the server broke. Its message names internal
  // modules, columns, and connection strings, so the client gets a fixed
  // sentence and the detail stays in the server log where it belongs.
  const message = isServerFault
    ? "Something went wrong on our side. Please try again."
    : translated?.message || error.message || "Request failed";

  res.status(status).json({
    message,
    ...(translated?.errors ? { errors: translated.errors } : {}),
    // Only when NODE_ENV says development or test, and never for a client error
    // where it adds nothing. This is "opt in", not "anything but production":
    // a deployment with NODE_ENV unset or misspelled ("staging", "prod") must not
    // hand stack traces and file paths to whoever triggers an error.
    ...(["development", "test"].includes(process.env.NODE_ENV) && isServerFault ? { stack: error.stack } : {})
  });
}

module.exports = { notFound, errorHandler };
