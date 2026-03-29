const { Resend } = require("resend");

let resend;

function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

async function sendPasswordResetEmail(toEmail, resetLink, userName) {
  const client = getResendClient();

  const { data, error } = await client.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: toEmail,
    subject: "Reset Your Password - Online Course Platform",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Online Course Platform</h1>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
          <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            Hi ${userName || "there"},
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            We received a request to reset your password. Click the button below to create a new password. This link will expire in 15 minutes.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" 
               style="background: #7c3aed; color: #ffffff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">
            If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} Online Course Platform. All rights reserved.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send password reset email");
  }

  return data;
}

async function sendWelcomeEmail(toEmail, userName, role, tempPassword) {
  const client = getResendClient();

  const roleLabels = {
    admin: "Admin",
    coordinator: "Course Coordinator",
    teacher: "Teacher",
    student: "Student",
  };

  const loginUrl =
    role === "student"
      ? process.env.STUDENT_FRONTEND_URL
      : process.env.ADMIN_FRONTEND_URL;

  const { data, error } = await client.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: toEmail,
    subject: `Welcome to Online Course Platform - Your ${roleLabels[role] || role} Account`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Online Course Platform</h1>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
          <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">Welcome, ${userName}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            Your <strong>${roleLabels[role] || role}</strong> account has been created. Here are your login credentials:
          </p>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #334155; font-size: 14px; margin: 0 0 8px;">
              <strong>Email:</strong> ${toEmail}
            </p>
            <p style="color: #334155; font-size: 14px; margin: 0 0 8px;">
              <strong>Temporary Password:</strong> ${tempPassword}
            </p>
            <p style="color: #334155; font-size: 14px; margin: 0;">
              <strong>Role:</strong> ${roleLabels[role] || role}
            </p>
          </div>
          <p style="color: #ef4444; font-size: 13px; line-height: 1.6; margin: 0 0 24px;">
            Please change your password after your first login for security.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginUrl}" 
               style="background: #7c3aed; color: #ffffff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
              Login Now
            </a>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} Online Course Platform. All rights reserved.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend welcome email error:", error);
    throw new Error("Failed to send welcome email");
  }

  return data;
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail };
