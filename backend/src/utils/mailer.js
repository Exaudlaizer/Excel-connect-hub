/**
 * Mail transport.
 *
 * Configured with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS, mail is sent
 * for real through nodemailer. With none of those set, the message is printed
 * to the server console instead, so the whole verification and reset flow is
 * usable in development without an account anywhere.
 *
 * The transporter is created once and reused. Building one per message opens a
 * new TCP and TLS handshake every time, which is slow and gets a sender
 * throttled by most providers.
 */

let cachedTransport;
let verified = false;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function fromAddress() {
  return process.env.SMTP_FROM || `Excel Connect Hub <${process.env.SMTP_USER || "no-reply@excelconnecthub.local"}>`;
}

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const nodemailer = require("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plaintext and upgrade via STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 3
  });

  return cachedTransport;
}

/**
 * Checks the SMTP credentials once at boot.
 *
 * Without this a bad password only surfaces when the first user tries to
 * register, as a failed send buried in a request log.
 */
async function verifyTransport() {
  if (!smtpConfigured()) {
    console.log("Mail: no SMTP configured — messages will be printed to this console.");
    return false;
  }

  try {
    await getTransport().verify();
    verified = true;
    console.log(`Mail: SMTP ready at ${process.env.SMTP_HOST}`);
    return true;
  } catch (error) {
    console.error(`Mail: SMTP configured but not usable — ${error.message}`);
    console.error("Mail: falling back to console output so the app still runs.");
    cachedTransport = undefined;
    return false;
  }
}

function sendViaConsole({ to, subject, text }) {
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

async function sendMail({ to, subject, text, html }) {
  if (!smtpConfigured()) {
    sendViaConsole({ to, subject, text });
    return { delivered: false, transport: "console" };
  }

  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject, text, html });
    return { delivered: true, transport: "smtp" };
  } catch (error) {
    // A failed send must not take down the request that triggered it: the user
    // has an account either way, and can ask for another code. The failure is
    // logged, and the message is echoed so a developer can still complete the
    // flow locally.
    console.error(`Mail: could not send to ${to} — ${error.message}`);
    sendViaConsole({ to, subject, text });
    return { delivered: false, transport: "console", error: error.message };
  }
}

/* ---------------------------------------------------------------------------
   Templates
   ---------------------------------------------------------------------------
   Plain text is always provided alongside the HTML: some clients refuse HTML,
   and a code that only exists inside a <table> is useless to them.
   ------------------------------------------------------------------------- */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
}

function layout({ heading, body, code }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2130">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e6e8ee">
    <tr><td style="padding:28px 28px 0">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;color:#b07c20">EXCEL CONNECT HUB</p>
      <h1 style="margin:14px 0 0;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
    </td></tr>
    <tr><td style="padding:16px 28px 0;font-size:15px;line-height:1.65;color:#4a5364">${body}</td></tr>
    ${
      code
        ? `<tr><td style="padding:24px 28px 0" align="center">
             <div style="display:inline-block;padding:16px 26px;background:#faf6ec;border:1px solid #e9dcbb;border-radius:12px">
               <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:.22em;color:#1b2130">${escapeHtml(code)}</span>
             </div>
           </td></tr>`
        : ""
    }
    <tr><td style="padding:24px 28px 28px;font-size:13px;line-height:1.6;color:#7c8698;border-top:1px solid #eef0f4;margin-top:20px">
      If you did not request this, you can ignore this email and nothing will change.
    </td></tr>
  </table>
</body></html>`;
}

function otpTemplate({ name, code, purpose, minutes, target }) {
  const what = purpose === "phone" ? "phone number" : "email address";
  const heading = purpose === "phone" ? "Confirm your phone number" : "Confirm your email address";

  return {
    subject: `${code} is your Excel Connect Hub verification code`,
    text: [
      `Hello ${name},`,
      "",
      `Your Excel Connect Hub verification code is: ${code}`,
      "",
      `Enter it to confirm the ${what}${target ? ` ${target}` : ""}.`,
      `The code expires in ${minutes} minutes and can be used once.`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: layout({
      heading,
      code,
      body: `<p style="margin:0 0 12px">Hello ${escapeHtml(name)},</p>
             <p style="margin:0">Enter this code to confirm the ${what}${
               target ? ` <strong style="color:#1b2130">${escapeHtml(target)}</strong>` : ""
             }. It expires in ${minutes} minutes and can only be used once.</p>`
    })
  };
}

function passwordResetTemplate({ name, link, minutes }) {
  return {
    subject: "Reset your Excel Connect Hub password",
    text: [
      `Hello ${name},`,
      "",
      "Use this link to choose a new password:",
      link,
      "",
      `The link expires in ${minutes} minutes and can be used once.`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: layout({
      heading: "Choose a new password",
      body: `<p style="margin:0 0 12px">Hello ${escapeHtml(name)},</p>
             <p style="margin:0 0 20px">Use the button below to choose a new password. The link expires in ${minutes} minutes and can be used once.</p>
             <p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:#b07c20;color:#fffcf5;text-decoration:none;border-radius:10px;font-weight:700">Reset password</a></p>
             <p style="margin:18px 0 0;font-size:13px;color:#7c8698;word-break:break-all">${escapeHtml(link)}</p>`
    })
  };
}

module.exports = {
  sendMail,
  smtpConfigured,
  verifyTransport,
  otpTemplate,
  passwordResetTemplate,
  isVerified: () => verified
};
