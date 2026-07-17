// Pluggable mail transport.
//
// No SMTP configured (the default): the message is printed to the server console,
// so the whole password-reset flow is usable in development with zero setup.
//
// To send real email, set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS and
// install nodemailer (`npm install nodemailer`). Nothing else has to change.

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendViaConsole({ to, subject, text }) {
  console.log(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      " EMAIL (console transport — no SMTP configured)",
      ` To:      ${to}`,
      ` Subject: ${subject}`,
      "──────────────────────────────────────────────────────────────",
      text,
      "──────────────────────────────────────────────────────────────",
      ""
    ].join("\n")
  );
}

async function sendViaSmtp({ to, subject, text }) {
  let nodemailer;

  try {
    // Required lazily so the dependency is only needed when SMTP is actually used.
    nodemailer = require("nodemailer");
  } catch (error) {
    throw new Error("SMTP_HOST is set but nodemailer is not installed. Run: npm install nodemailer");
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || "Excel Connect Hub <no-reply@excelconnecthub.local>",
    to,
    subject,
    text
  });
}

async function sendMail(message) {
  if (smtpConfigured()) return sendViaSmtp(message);
  return sendViaConsole(message);
}

module.exports = { sendMail, smtpConfigured };
