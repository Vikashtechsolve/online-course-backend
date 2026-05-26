/**
 * HTML email template for paid course registration confirmation.
 * Uses table layout + hosted icons for broad email client support.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInr(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return escapeHtml(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const ICON = {
  check:
    "https://img.icons8.com/fluency/96/checkmark.png",
  course:
    "https://img.icons8.com/fluency/48/artificial-intelligence.png",
  calendar:
    "https://img.icons8.com/fluency/48/calendar.png",
  payment:
    "https://img.icons8.com/fluency/48/bill.png",
  next:
    "https://img.icons8.com/fluency/48/rocket.png",
  email:
    "https://img.icons8.com/fluency/48/new-post.png",
  phone:
    "https://img.icons8.com/fluency/48/phone.png",
  web:
    "https://img.icons8.com/fluency/48/domain.png",
};

function summaryRow(iconUrl, label, value) {
  return `
    <tr>
      <td width="44" valign="top" style="padding:10px 0;">
        <img src="${iconUrl}" width="28" height="28" alt="" style="display:block;border:0;" />
      </td>
      <td valign="top" style="padding:10px 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(label)}</p>
        <p style="margin:4px 0 0;font-size:15px;color:#0f172a;font-weight:600;line-height:1.4;">${escapeHtml(value)}</p>
      </td>
    </tr>`;
}

function buildCourseRegistrationHtml(data) {
  const {
    fullName,
    courseName,
    batchName,
    batchStart,
    paymentPlanLabel,
    amountPaid,
    balanceDue,
    paymentId,
    nextSteps,
    supportEmail,
    supportPhone,
    websiteUrl,
    logoUrl,
    lmsUrl,
  } = data;

  const name = escapeHtml(fullName);
  const course = escapeHtml(courseName);
  const batch = escapeHtml(batchName || "Upcoming batch");
  const start = escapeHtml(batchStart || "Announced soon");
  const plan = escapeHtml(paymentPlanLabel);
  const paid = formatInr(amountPaid);
  const due = formatInr(balanceDue);
  const payId = escapeHtml(paymentId || "N/A");
  const steps = escapeHtml(nextSteps);
  const email = escapeHtml(supportEmail);
  const phone = escapeHtml(supportPhone);
  const phoneTel = escapeHtml(
    String(supportPhone || "").replace(/[^\d+]/g, "")
  );
  const site = escapeHtml(websiteUrl);
  const logo = logoUrl ? escapeHtml(logoUrl) : "";
  const lms = escapeHtml(lmsUrl || websiteUrl);

  const logoBlock = logo
    ? `<img src="${logo}" width="140" height="auto" alt="Vikash Tech Solution" style="display:block;border:0;max-height:52px;margin:0 auto;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#B11C20;letter-spacing:0.08em;">VTS</div>
       <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#64748b;margin-top:4px;letter-spacing:0.12em;text-transform:uppercase;">Vikash Tech Solution</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Registration Confirmed — ${course}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Logo bar -->
          <tr>
            <td align="center" style="padding:0 0 16px;">
              <a href="${site}" style="text-decoration:none;">${logoBlock}</a>
            </td>
          </tr>

          <!-- Hero card -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;background:linear-gradient(135deg,#B11C20 0%,#87021C 55%,#4a0a12 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 28px 28px;text-align:center;">
                    <img src="${ICON.check}" width="72" height="72" alt="Success" style="display:block;margin:0 auto 16px;border:0;" />
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.25;">
                      You are registered!
                    </h1>
                    <p style="margin:12px 0 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#fecdd3;line-height:1.5;">
                      ${course}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 28px;">
                    <img src="${ICON.course}" width="100%" alt="Generative AI" style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;border:0;margin:0 auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 28px;">
              <p style="margin:0 0 8px;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;color:#0f172a;line-height:1.5;">
                Hi <strong style="color:#B11C20;">${name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#475569;line-height:1.65;">
                Thank you for joining <strong>Vikash Tech Solution (VTS)</strong>.
                Your payment was received successfully and your seat is officially reserved.
                Please save this email for your records.
              </p>

              <!-- Registration details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:700;color:#B11C20;text-transform:uppercase;letter-spacing:0.06em;">
                      Registration summary
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${summaryRow(ICON.calendar, "Batch", batch)}
                      ${summaryRow(ICON.calendar, "Starts on", start)}
                      ${summaryRow(ICON.payment, "Payment plan", plan)}
                      ${summaryRow(ICON.payment, "Amount paid", paid)}
                      ${summaryRow(ICON.payment, "Balance at joining", due)}
                      ${summaryRow(ICON.payment, "Payment reference", payId)}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next steps -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(90deg,#fff7ed 0%,#ffffff 100%);border:1px solid #fed7aa;border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td width="56" valign="top" style="padding:18px 0 18px 16px;">
                    <img src="${ICON.next}" width="40" height="40" alt="" style="display:block;border:0;" />
                  </td>
                  <td valign="top" style="padding:18px 16px 18px 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.04em;">What happens next</p>
                    <p style="margin:0;font-size:14px;color:#334155;line-height:1.65;">${steps}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${lms}" style="display:inline-block;background:linear-gradient(90deg,#B11C20,#87021C);color:#ffffff;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;box-shadow:0 4px 14px rgba(177,28,32,0.35);">
                      Visit VTS Platform
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">Need help? We are here for you</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="36" valign="middle"><img src="${ICON.email}" width="24" height="24" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:6px 0;"><a href="mailto:${email}" style="color:#B11C20;font-size:14px;font-weight:600;text-decoration:none;">${email}</a></td>
                      </tr>
                      <tr>
                        <td width="36" valign="middle"><img src="${ICON.phone}" width="24" height="24" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:6px 0;"><a href="tel:${phoneTel}" style="color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;">${phone}</a></td>
                      </tr>
                      <tr>
                        <td width="36" valign="middle"><img src="${ICON.web}" width="24" height="24" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:6px 0;"><a href="${site}" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">${site}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#475569;line-height:1.6;">
                With gratitude,<br />
                <strong style="color:#B11C20;">Team Vikash Tech Solution</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#0f172a;border-radius:0 0 16px 16px;padding:22px 28px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5;">
                Vikash Tech Solution · Career-ready tech programs
              </p>
              <p style="margin:0;font-size:12px;color:#64748b;">
                © ${new Date().getFullYear()} VTS. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildCourseRegistrationHtml, escapeHtml, formatInr };
