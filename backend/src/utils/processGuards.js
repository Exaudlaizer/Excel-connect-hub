/**
 * Last-resort handlers for crashes nobody caught.
 *
 * On an uncaught exception or unhandled rejection: log it as JSON, report it,
 * email the operators (waiting at most a few seconds), flush the reporter, and
 * exit non-zero so the host restarts the process. Staying alive after an
 * uncaught exception is unsafe because the process state is unknown.
 *
 * Everything is injected so it can be tested without killing the test runner.
 */
function installProcessHandlers({ proc = process, alert, capture, flush, exit = process.exit, log = console.error, waitMs = 3000 } = {}) {
  let handling = false;

  const handle = (kind) => async (error) => {
    if (handling) return;
    handling = true;

    const err = error instanceof Error ? error : new Error(String(error));
    log(JSON.stringify({ level: "fatal", kind, message: err.message, stack: err.stack }));

    try {
      capture?.(err, { kind });
      await Promise.race([
        Promise.resolve(alert?.({ key: "process-crash", subject: `API crashed (${kind})`, text: `The API process hit an unhandled error and is restarting.\n\nKind: ${kind}\nMessage: ${err.message}` })),
        new Promise((resolve) => setTimeout(resolve, waitMs).unref?.())
      ]);
      await flush?.();
    } catch (_error) {
      // Nothing more can be done; fall through to exit.
    }
    exit(1);
  };

  proc.on("uncaughtException", handle("uncaughtException"));
  proc.on("unhandledRejection", handle("unhandledRejection"));
}

module.exports = { installProcessHandlers };
