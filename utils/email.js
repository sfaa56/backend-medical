const nodemailer = require("nodemailer");

async function createTransporter() {
  // Use env vars: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: "tafm fugi hcxm ques", // Your email password or app password
    },
  });
}

async function sendEmail({ to, subject, text, html }) {
  try {
    const transporter = await createTransporter();
    const from =
      process.env.EMAIL_FROM || `no-reply@${process.env.DOMAIN || "localhost"}`;

    const info = await transporter.sendMail({
      from: "baittakk@gmail.com",
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
}

// Simple HTML builder for reset email
function resetPasswordEmailHtml({
  name = "User",
  resetUrl,
  expiryMinutes = 10,
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#111;">
      <h2>Password reset requested</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to set a new password. This link will expire in ${expiryMinutes} minutes.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none;">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Thanks,<br/>Your App Team</p>
    </div>
  `;
}

module.exports = { sendEmail, resetPasswordEmailHtml };