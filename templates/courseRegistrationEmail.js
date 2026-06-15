/**
 * HTML email template for paid course registration confirmation.
 * Logo: 500×500 PNG with black background — display in a dark header at fixed size.
 */

const LOGO_DISPLAY_WIDTH = 140;
const LOGO_DISPLAY_HEIGHT = 140;

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
  check: "https://img.icons8.com/fluency/96/checkmark.png",
  calendar: "https://img.icons8.com/fluency/48/calendar.png",
  payment: "https://img.icons8.com/fluency/48/bill.png",
  next: "https://img.icons8.com/fluency/48/rocket.png",
  email: "https://img.icons8.com/fluency/48/new-post.png",
  phone: "https://img.icons8.com/fluency/48/phone.png",
  web: "https://img.icons8.com/fluency/48/domain.png",
};

function buildLogoHeader(logoUrl, siteUrl) {
  const site = escapeHtml(siteUrl);
  const logo = escapeHtml(logoUrl);

  if (!logoUrl) {
    return `
      <tr>
        <td align="center" style="background-color:#000000;padding:28px 24px 24px;border-radius:16px 16px 0 0;">
          <a href="${site}" style="text-decoration:none;display:inline-block;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;color:#B11C20;letter-spacing:0.1em;">VTS</p>
            <p style="margin:6px 0 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#fecaca;letter-spacing:0.14em;text-transform:uppercase;">Vikash Tech Solution</p>
          </a>
        </td>
      </tr>`;
  }

  return `
    <tr>
      <td align="center" style="background-color:#000000;padding:24px 24px 20px;border-radius:16px 16px 0 0;">
        <a href="${site}" style="text-decoration:none;display:inline-block;line-height:0;">
          <img
            src="${logo}"
            width="${LOGO_DISPLAY_WIDTH}"
            height="${LOGO_DISPLAY_HEIGHT}"
            alt="Vikash Tech Solution"
            style="display:block;border:0;outline:none;text-decoration:none;width:${LOGO_DISPLAY_WIDTH}px;height:${LOGO_DISPLAY_HEIGHT}px;max-width:${LOGO_DISPLAY_WIDTH}px;-ms-interpolation-mode:bicubic;"
          />
        </a>
      </td>
    </tr>`;
}

function summaryRow(iconUrl, label, value, highlight) {
  const valueColor = highlight ? "#B11C20" : "#0f172a";
  return `
    <tr>
      <td width="40" valign="middle" style="padding:11px 0;border-bottom:1px solid #f1f5f9;">
        <img src="${iconUrl}" width="24" height="24" alt="" style="display:block;border:0;" />
      </td>
      <td valign="middle" style="padding:11px 0 11px 10px;border-bottom:1px solid #f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</p>
        <p style="margin:3px 0 0;font-size:15px;color:${valueColor};font-weight:600;line-height:1.35;">${escapeHtml(value)}</p>
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
  const phoneTel = escapeHtml(String(supportPhone || "").replace(/[^\d+]/g, ""));
  const site = escapeHtml(websiteUrl);
  const lms = escapeHtml(lmsUrl || websiteUrl);
  const year = new Date().getFullYear();

  const balanceRow =
    Number(balanceDue) > 0
      ? summaryRow(ICON.payment, "Balance at joining", due, true)
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Registration Confirmed — ${course}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f2f1;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f2f1;">
    <tr>
      <td align="center" style="padding:28px 16px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">

          ${buildLogoHeader(logoUrl, websiteUrl)}

          <!-- Success hero -->
          <tr>
            <td style="background:linear-gradient(135deg,#B11C20 0%,#9a181c 45%,#87021C 100%);padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:32px 28px 28px;">
                    <img src="${ICON.check}" width="64" height="64" alt="Success" style="display:block;margin:0 auto 14px;border:0;" />
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">
                      Registration confirmed
                    </h1>
                    <p style="margin:10px 0 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#fecdd3;line-height:1.5;">
                      ${course}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;border-left:1px solid #e7e5e4;border-right:1px solid #e7e5e4;padding:32px 28px 28px;">
              <p style="margin:0 0 6px;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;color:#0f172a;line-height:1.5;">
                Hi <strong style="color:#B11C20;">${name}</strong>,
              </p>
              <p style="margin:0 0 26px;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#475569;line-height:1.65;">
                Thank you for enrolling with <strong>Vikash Tech Solution</strong>.
                Your payment was received successfully and your seat is officially reserved.
                Please keep this email for your records.
              </p>

              <!-- Registration summary -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e7e5e4;border-radius:14px;margin-bottom:18px;">
                <tr>
                  <td style="padding:16px 18px 6px;">
                    <p style="margin:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;font-weight:700;color:#B11C20;text-transform:uppercase;letter-spacing:0.08em;">
                      Registration summary
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${summaryRow(ICON.calendar, "Batch", batch)}
                      ${summaryRow(ICON.calendar, "Starts on", start)}
                      ${summaryRow(ICON.payment, "Payment plan", plan)}
                      ${summaryRow(ICON.payment, "Amount paid", paid, true)}
                      ${balanceRow}
                      ${summaryRow(ICON.payment, "Payment reference", payId)}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next steps -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBEAEB;border:1px solid #F9DEDF;border-radius:14px;margin-bottom:22px;">
                <tr>
                  <td width="52" valign="top" style="padding:18px 0 18px 16px;">
                    <img src="${ICON.next}" width="36" height="36" alt="" style="display:block;border:0;" />
                  </td>
                  <td valign="top" style="padding:18px 16px 18px 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#B11C20;text-transform:uppercase;letter-spacing:0.05em;">What happens next</p>
                    <p style="margin:0;font-size:14px;color:#44403c;line-height:1.65;">${steps}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
                <tr>
                  <td align="center">
                    <a href="${lms}" style="display:inline-block;background-color:#B11C20;color:#ffffff;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;mso-padding-alt:0;">
                      <!--[if mso]><i style="letter-spacing:36px;mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
                      <span style="mso-text-raise:10pt;">Visit VTS Platform</span>
                      <!--[if mso]><i style="letter-spacing:36px;mso-font-width:-100%">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e7e5e4;border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Need help?</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="32" valign="middle" style="padding:5px 0;"><img src="${ICON.email}" width="20" height="20" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:5px 0;"><a href="mailto:${email}" style="color:#B11C20;font-size:14px;font-weight:600;text-decoration:none;">${email}</a></td>
                      </tr>
                      <tr>
                        <td width="32" valign="middle" style="padding:5px 0;"><img src="${ICON.phone}" width="20" height="20" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:5px 0;"><a href="tel:${phoneTel}" style="color:#334155;font-size:14px;font-weight:600;text-decoration:none;">${phone}</a></td>
                      </tr>
                      <tr>
                        <td width="32" valign="middle" style="padding:5px 0;"><img src="${ICON.web}" width="20" height="20" alt="" style="display:block;border:0;" /></td>
                        <td valign="middle" style="padding:5px 0;"><a href="${site}" style="color:#334155;font-size:14px;font-weight:600;text-decoration:none;">${site}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#475569;line-height:1.6;">
                With gratitude,<br />
                <strong style="color:#B11C20;">Team Vikash Tech Solution</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#000000;border-radius:0 0 16px 16px;padding:20px 28px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
              <p style="margin:0 0 4px;font-size:13px;color:#d6d3d1;line-height:1.5;">
                Vikash Tech Solution · Career-ready tech programs
              </p>
              <p style="margin:0;font-size:11px;color:#78716c;">
                © ${year} VTS. All rights reserved.
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

module.exports = {
  buildCourseRegistrationHtml,
  escapeHtml,
  formatInr,
  LOGO_DISPLAY_WIDTH,
  LOGO_DISPLAY_HEIGHT,
};
