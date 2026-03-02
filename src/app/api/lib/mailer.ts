import nodemailer from "nodemailer";
import User from "../models/userModel";
import bcryptjs from "bcryptjs";

type EmailType =
  | "VERIFY"
  | "RESET"
  | "ADMIN_OTP"
  | "OPERATOR_INVITE"
  | "OPERATOR_APPROVED"
  | "OPERATOR_REJECTED"
  | "OPERATOR_REMOVED_FROM_COMPANY"
  | "OPERATOR_REQUEST_TO_COMPANY"
  | "OPERATOR_REQUEST_SUBMITTED"
  | "COMPANY_OFFER_TO_OPERATOR"
  | "OPERATOR_OFFER_ACCEPTED"
  | "OPERATOR_OFFER_REJECTED"
  | "ORDER_CONFIRMED"
  | "ORDER_TRACKING_OTP"
  | "ORDER_UPDATED"
  | "ORDER_CANCELLED";

type SendEmailPayload = {
  email: string;
  emailType: EmailType;
  userId?: string;
  securityCode?: string;
  operatorName?: string;
  companyName?: string;
  adminName?: string;
  trackingId?: string;
  orderStatus?: string;
  orderNote?: string;
};

type MailResponseShape = {
  accepted?: unknown[];
  rejected?: unknown[];
};

export const wasEmailAccepted = (mailResponse: MailResponseShape) => {
  const acceptedCount = Array.isArray(mailResponse.accepted)
    ? mailResponse.accepted.length
    : 0;
  const rejectedCount = Array.isArray(mailResponse.rejected)
    ? mailResponse.rejected.length
    : 0;

  return acceptedCount > 0 && rejectedCount === 0;
};

export const sendEmail = async ({
  email,
  emailType,
  userId,
  securityCode,
  operatorName,
  companyName,
  adminName,
  trackingId,
  orderStatus,
  orderNote,
}: SendEmailPayload) => {
  try {
    let subject;
    let mainContent;

    // --- Create a hashed token for email verification ---
    if (emailType === "VERIFY") {
      if (!userId) {
        throw new Error("User id is required for verification emails.");
      }
      const hashedToken = await bcryptjs.hash(userId.toString(), 10);
      await User.findByIdAndUpdate(userId, {
        verifyToken: hashedToken,
        verifyTokenExpiry: Date.now() + 3600000, // 1 hour
      });

      subject = "Verify Your Email for Hapus Logistics";
      const verifyUrl = `${process.env.DOMAIN}/verifyemail?token=${hashedToken}`;
      mainContent = `
        <p>Welcome to Hapus Logistics!</p>
        <p>Please click the button below to verify your email address and activate your account.</p>
        <div class="button-container">
            <a href="${verifyUrl}" target="_blank" class="button">Verify Email</a>
        </div>
        <p>If you're having trouble with the button, please copy and paste the following link into your web browser:</p>
        <p><a href="${verifyUrl}" style="color: #16a34a; word-break: break-all;">${verifyUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
      `;
    } else if (emailType === "RESET") {
        if (!securityCode) {
          throw new Error("Security code is required for reset emails.");
        }
        subject = "Your Password Reset Code for Hapus Logistics";
        mainContent = `
            <p>We received a request to reset your password for your Hapus Logistics account.</p>
            <p>Enter the following code to reset your password:</p>
            <div class="code">
                <h2>${securityCode}</h2>
            </div>
            <p>This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
        `;
    } else if (emailType === "ADMIN_OTP") {
        if (!securityCode) {
          throw new Error("Security code is required for admin access emails.");
        }
        subject = "Your Admin Access Code for Hapus Logistics";
        mainContent = `
            <p>We received an admin sign-in request for your account.</p>
            <p>Use the one-time access code below to complete your login:</p>
            <div class="code">
                <h2>${securityCode}</h2>
            </div>
            <p>This code is valid for 10 minutes. If this wasn&apos;t you, please reset your password immediately.</p>
        `;
    } else if (emailType === "OPERATOR_INVITE") {
        subject = "Operator Invitation from Hapus Logistics";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p>You have been invited to join <strong>${companyName ?? "Hapus Logistics"}</strong> as an operator.</p>
            <p>Your request is currently pending admin confirmation.</p>
            <p>Once approved, you will receive a confirmation email and can continue your operator login flow.</p>
        `;
    } else if (emailType === "OPERATOR_APPROVED") {
        subject = "Operator Request Approved";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p>Your operator request for <strong>${companyName ?? "Hapus Logistics"}</strong> has been approved.</p>
            <p>You can now log in from the operator portal.</p>
        `;
    } else if (emailType === "OPERATOR_REJECTED") {
        subject = "Operator Request Update";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p>Your operator request for <strong>${companyName ?? "Hapus Logistics"}</strong> was not approved at this time.</p>
            <p>Please contact the admin for more details.</p>
        `;
    } else if (emailType === "OPERATOR_REMOVED_FROM_COMPANY") {
        subject = "Removed From Company";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p>You have been removed from <strong>${companyName ?? "your company"}</strong>.</p>
            <p>If you have questions, please contact your company admin. You can request to join another company from your operator dashboard.</p>
        `;
    } else if (emailType === "OPERATOR_REQUEST_TO_COMPANY") {
        subject = "New Operator Request Received";
        mainContent = `
            <p>Hello ${adminName ?? "Admin"},</p>
            <p><strong>${operatorName ?? "An operator"}</strong> requested to join <strong>${companyName ?? "your company"}</strong>.</p>
            <p>Please review this request from your dashboard and approve or reject it.</p>
        `;
    } else if (emailType === "OPERATOR_REQUEST_SUBMITTED") {
        subject = "Operator Request Submitted";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p>Your join request has been sent to <strong>${companyName ?? "the selected company"}</strong>.</p>
            <p>You'll receive an update once the admin reviews your request.</p>
        `;
    } else if (emailType === "COMPANY_OFFER_TO_OPERATOR") {
        subject = "Company Offer from Hapus Logistics";
        mainContent = `
            <p>Hello ${operatorName ?? "Operator"},</p>
            <p><strong>${companyName ?? "A company"}</strong> invited you to join as an operator.</p>
            <p>Please log in to your operator dashboard and accept or reject this offer.</p>
        `;
    } else if (emailType === "OPERATOR_OFFER_ACCEPTED") {
        subject = "Operator Accepted Company Offer";
        mainContent = `
            <p>Hello ${adminName ?? "Admin"},</p>
            <p><strong>${operatorName ?? "Operator"}</strong> accepted your company offer and is now linked with <strong>${companyName ?? "your company"}</strong>.</p>
        `;
    } else if (emailType === "OPERATOR_OFFER_REJECTED") {
        subject = "Operator Rejected Company Offer";
        mainContent = `
            <p>Hello ${adminName ?? "Admin"},</p>
            <p><strong>${operatorName ?? "Operator"}</strong> rejected the company offer from <strong>${companyName ?? "your company"}</strong>.</p>
        `;
    } else if (emailType === "ORDER_CONFIRMED") {
        subject = "Your Order Is Confirmed";
        mainContent = `
            <p>Hello,</p>
            <p>Your booking has been confirmed successfully.</p>
            <p><strong>Tracking ID:</strong> ${trackingId ?? "Pending"}</p>
            <p>You can track your order anytime from your dashboard.</p>
        `;
    } else if (emailType === "ORDER_TRACKING_OTP") {
        if (!securityCode) {
          throw new Error("Security code is required for order tracking verification.");
        }
        subject = "Your Order Tracking Verification Code";
        mainContent = `
            <p>Hello,</p>
            <p>Use the code below to verify and track your order.</p>
            ${trackingId ? `<p><strong>Tracking ID:</strong> ${trackingId}</p>` : ""}
            <div class="code">
                <h2>${securityCode}</h2>
            </div>
            <p>This code is valid for 10 minutes.</p>
        `;
    } else if (emailType === "ORDER_UPDATED") {
        subject = "Order Update From Admin";
        mainContent = `
            <p>Hello,</p>
            <p>Your order details were updated by admin.</p>
            <p><strong>Tracking ID:</strong> ${trackingId ?? "Pending"}</p>
            ${orderStatus ? `<p><strong>Current Status:</strong> ${orderStatus}</p>` : ""}
            ${orderNote ? `<p><strong>Admin Note:</strong> ${orderNote}</p>` : ""}
            <p>Please check your dashboard for latest order details.</p>
        `;
    } else if (emailType === "ORDER_CANCELLED") {
        subject = "Your Order Was Cancelled";
        mainContent = `
            <p>Hello,</p>
            <p>Your order has been cancelled by admin.</p>
            <p><strong>Tracking ID:</strong> ${trackingId ?? "Pending"}</p>
            ${orderNote ? `<p><strong>Reason/Note:</strong> ${orderNote}</p>` : ""}
            <p>If this seems incorrect, please contact support.</p>
        `;
    } else {
      throw new Error("Invalid email type");
    }

    // --- HTML Email Template ---
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
              body {
                  font-family: 'Poppins', sans-serif;
                  background-color: #f4f4f4;
                  color: #333;
                  margin: 0;
                  padding: 0;
              }
              .container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: #ffffff;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              }
              .header {
                  background: linear-gradient(to right, #000000, #333333);
                  color: #ffffff;
                  padding: 40px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 32px;
                  font-weight: 700;
                  letter-spacing: 1.5px;
              }
              .content {
                  padding: 40px;
                  line-height: 1.8;
                  font-size: 16px;
              }
              .content p {
                  margin-top: 0;
              }
              .button-container {
                  text-align: center;
                  margin: 30px 0;
              }
              .button {
                  background: linear-gradient(to right, #16a34a, #15803d);
                  color: #ffffff !important;
                  text-decoration: none;
                  padding: 15px 35px;
                  border-radius: 50px;
                  font-size: 18px;
                  font-weight: 600;
                  display: inline-block;
              }
              .code {
                  background-color: #f0f0f0;
                  padding: 20px;
                  text-align: center;
                  border-radius: 8px;
                  margin: 30px 0;
              }
              .code h2 {
                  font-size: 40px;
                  color: #16a34a;
                  margin: 0;
                  letter-spacing: 5px;
              }
              .footer {
                  background-color: #f9f9f9;
                  color: #777;
                  padding: 30px;
                  text-align: center;
                  font-size: 12px;
              }
              .footer p {
                  margin: 5px 0;
              }
              .footer a {
                  color: #16a34a;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Hapus Logistics</h1>
              </div>
              <div class="content">
                  ${mainContent}
              </div>
              <div class="footer">
                  <p>Developed with ❤️ by Dnyandeep and Atharva</p>
                  <p><strong>Hapus Logistics</strong></p>
                  <p>123 Logistic Avenue, Pune, Maharashtra, 411001</p>
                  <p><a href="https://hapuslogistics.com/terms">Terms of Service</a> | <a href="https://hapuslogistics.com/privacy">Privacy Policy</a></p>
                  <p>&copy; ${new Date().getFullYear()} Hapus Logistics. All Rights Reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    // --- Nodemailer Transport and Mail Options ---
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: "dnyandeep.gaonkar24@spit.ac.in",
      to: email,
      subject: subject,
      html: htmlContent,
    };

    const mailresponse = await transport.sendMail(mailOptions);
    return mailresponse;
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to send email.",
    );
  }
};
