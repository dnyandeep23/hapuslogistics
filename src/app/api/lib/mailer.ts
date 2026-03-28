import nodemailer from "nodemailer";
import bcryptjs from "bcryptjs";
import User from "../models/userModel";
import CompanyProfile from "../models/companyProfileModel";

type EmailType =
  | "VERIFY"
  | "RESET"
  | "ADMIN_OTP"
  | "OPERATOR_INVITE"
  | "OPERATOR_ACCOUNT_CREATED"
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
  temporaryPassword?: string;
  operatorName?: string;
  companyName?: string;
  adminName?: string;
  trackingId?: string;
  orderStatus?: string;
  orderNote?: string;
  packages?: { name: string; image: string; type: string; weight?: string; size?: string }[];
};

type MailResponseShape = {
  accepted?: unknown[];
  rejected?: unknown[];
};

type EmailDetail = {
  label: string;
  value: string;
};

type EmailContent = {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  paragraphs: string[];
  details?: EmailDetail[];
  highlightLabel?: string;
  highlightValue?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
  packages?: { name: string; image: string; type: string; weight?: string; size?: string }[];
  appName: string;
  businessAddress: string;
};

type UnknownRecord = Record<string, unknown>;

export type OrderEmailPackage = {
  name: string;
  image: string;
  type: string;
  weight?: string;
  size?: string;
};

// These remain as hardcoded fallbacks if DB fetch fails
const FALLBACK_APP_NAME = "Hapus Logistics";
const DOMAIN = process.env.DOMAIN?.replace(/\/$/, "") || "https://hapuslogistics.com";
const SUPPORT_EMAIL = "support@hapuslogistics.com";
const SUPPORT_PHONE = "+91 98765 43210";
const FALLBACK_BUSINESS_ADDRESS = "138/D, Kinny House Room No. 1, 2nd Floor, near Parcel ST Depot, Pune, Maharashtra 411001";
const LEGACY_VERIFIED_FROM_EMAIL = "dnyandeep.gaonkar24@spit.ac.in";

const isLikelySmtpLoginAddress = (value: string) => /@smtp-brevo\.com$/i.test(value.trim());

const resolveFromEmail = () => {
  const configuredFrom = process.env.EMAIL_FROM?.trim();
  if (configuredFrom) {
    return configuredFrom;
  }

  const smtpUser = process.env.EMAIL_USER?.trim();
  if (smtpUser && !isLikelySmtpLoginAddress(smtpUser)) {
    return smtpUser;
  }

  return LEGACY_VERIFIED_FROM_EMAIL;
};

const DEFAULT_FROM_EMAIL = resolveFromEmail();
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO?.trim() || SUPPORT_EMAIL;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDisplay = (value?: string, fallback = "Not specified"): string => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const formatOrderStatus = (value?: string): string =>
  formatDisplay(value, "Pending").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

export const mapOrderPackagesForEmail = (packages: unknown): OrderEmailPackage[] | undefined => {
  if (!Array.isArray(packages)) return undefined;

  const mapped = packages.map((pkg) => {
    const safePkg = (pkg && typeof pkg === "object" ? pkg : {}) as UnknownRecord;
    return {
      name: String(safePkg.packageName || safePkg.description || "Package"),
      image: String(safePkg.packageImage || ""),
      type: String(safePkg.packageType || "Standard"),
      weight: String(safePkg.packageWeight || safePkg.weightKg || ""),
      size: String(safePkg.packageSize || ""),
    };
  });

  return mapped.length > 0 ? mapped : undefined;
};

const toTextLines = (content: EmailContent): string => {
  const lines = [
    content.appName,
    content.subject,
    "",
    content.heading,
    content.intro,
    "",
  ];

  for (const paragraph of content.paragraphs) {
    lines.push(paragraph, "");
  }

  if (content.details?.length) {
    for (const detail of content.details) {
      lines.push(`${detail.label}: ${detail.value}`);
    }
    lines.push("");
  }

  if (content.highlightLabel && content.highlightValue) {
    lines.push(`${content.highlightLabel}: ${content.highlightValue}`, "");
  }

  if (content.ctaLabel && content.ctaUrl) {
    lines.push(`${content.ctaLabel}: ${content.ctaUrl}`, "");
  }

  if (content.note) {
    lines.push(content.note, "");
  }

  lines.push(
    `Support: ${SUPPORT_EMAIL} | ${SUPPORT_PHONE}`,
    content.businessAddress,
    `${content.appName} © ${new Date().getFullYear()}`,
  );

  return lines.join("\n");
};

const renderDetailRows = (details: EmailDetail[] = []) =>
  details
    .map(
      (detail) => `
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px; width: 160px; vertical-align: top;">
            ${escapeHtml(detail.label)}
          </td>
          <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 600;">
            ${escapeHtml(detail.value)}
          </td>
        </tr>
      `,
    )
    .join("");

const renderParagraphs = (paragraphs: string[]) =>
  paragraphs
    .map(
      (paragraph) => `
        <p style="margin: 0 0 14px; color: #4b5563; font-size: 15px; line-height: 1.75;">
          ${escapeHtml(paragraph)}
        </p>
      `,
    )
    .join("");

const buildHtmlTemplate = (content: EmailContent) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(content.subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #edf2e8; font-family: Arial, Helvetica, sans-serif; color: #111827;">
      <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
        ${escapeHtml(content.preheader)}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #edf2e8; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 640px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(16, 24, 16, 0.12);">
              <tr>
                <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #11160f 0%, #24311f 60%, #38472f 100%);">
                  <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(213, 228, 0, 0.12); color: #f6ff6a; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">
                    ${escapeHtml(content.eyebrow)}
                  </div>
                  <h1 style="margin: 18px 0 10px; color: #ffffff; font-size: 30px; line-height: 1.2;">
                    ${escapeHtml(content.heading)}
                  </h1>
                  <p style="margin: 0; color: rgba(255,255,255,0.78); font-size: 15px; line-height: 1.75;">
                    ${escapeHtml(content.intro)}
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding: 32px;">
                  ${renderParagraphs(content.paragraphs)}

                  ${
                    content.packages?.length
                      ? `
                        <div style="margin: 24px 0;">
                          <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Package Details</h3>
                          ${content.packages
                            .filter(p => p.image || p.name)
                            .map(
                              (pkg) => `
                              <div style="display: table; width: 100%; margin-bottom: 12px; padding: 12px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02); background: #fbfcf8;">
                                <div style="display: table-cell; vertical-align: middle; width: 64px;">
                                  <div style="width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #e5e7eb;">
                                    ${
                                      pkg.image
                                        ? `<img src="${escapeHtml(pkg.image)}" alt="Package" style="width: 100%; height: 100%; object-fit: cover;" />`
                                        : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 10px;">No Image</div>`
                                    }
                                  </div>
                                </div>
                                <div style="display: table-cell; vertical-align: middle; padding-left: 14px;">
                                  <div style="font-weight: 700; color: #1f2937; font-size: 14px; margin-bottom: 2px;">
                                    ${escapeHtml(pkg.name || "Unnamed Package")}
                                  </div>
                                  <div style="color: #6b7280; font-size: 12px;">
                                    ${escapeHtml(pkg.type || "Standard")} • ${escapeHtml(pkg.weight ? pkg.weight + ' kg' : 'N/A')} • ${escapeHtml(pkg.size || 'N/A')}
                                  </div>
                                </div>
                              </div>
                            `
                            ).join("")}
                        </div>
                      `
                      : ""
                  }

                  ${
                    content.highlightLabel && content.highlightValue
                      ? `
                        <div style="margin: 22px 0; border: 1px solid rgba(205, 214, 69, 0.18); border-radius: 20px; background: linear-gradient(180deg, rgba(205, 214, 69, 0.08), rgba(255,255,255,0.7)); padding: 24px; text-align: center;">
                          <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin-bottom: 10px;">
                            ${escapeHtml(content.highlightLabel)}
                          </div>
                          <div style="font-size: 30px; letter-spacing: 0.14em; font-weight: 700; color: #1f3a1a;">
                            ${escapeHtml(content.highlightValue)}
                          </div>
                        </div>
                      `
                      : ""
                  }

                  ${
                    content.details?.length
                      ? `
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 18px 0 0;">
                          ${renderDetailRows(content.details)}
                        </table>
                      `
                      : ""
                  }

                  ${
                    content.ctaLabel && content.ctaUrl
                      ? `
                        <div style="margin: 28px 0 10px; text-align: center;">
                          <a
                            href="${escapeHtml(content.ctaUrl)}"
                            target="_blank"
                            rel="noreferrer"
                            style="display: inline-block; padding: 14px 26px; border-radius: 999px; background: linear-gradient(135deg, #cdd645 0%, #9eb31d 100%); color: #14210f; font-size: 15px; font-weight: 700; text-decoration: none;"
                          >
                            ${escapeHtml(content.ctaLabel)}
                          </a>
                        </div>
                      `
                      : ""
                  }

                  ${
                    content.note
                      ? `
                        <div style="margin-top: 22px; padding: 16px 18px; border-radius: 16px; background: #f7f8f3; color: #6b7280; font-size: 13px; line-height: 1.7;">
                          ${escapeHtml(content.note)}
                        </div>
                      `
                      : ""
                  }
                </td>
              </tr>

              <tr>
                <td style="padding: 24px 32px 30px; border-top: 1px solid #e5e7eb; background: #fbfcf8;">
                  <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 700;">
                    ${escapeHtml(content.appName)}
                  </p>
                  <p style="margin: 0 0 6px; color: #6b7280; font-size: 13px;">
                    ${SUPPORT_EMAIL} | ${SUPPORT_PHONE}
                  </p>
                  <p style="margin: 0 0 14px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    ${escapeHtml(content.businessAddress)}
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    <a href="${DOMAIN}/terms" style="color: #5f7f18; text-decoration: none;">Terms &amp; Conditions</a>
                    &nbsp;|&nbsp;
                    <a href="${DOMAIN}/privacy" style="color: #5f7f18; text-decoration: none;">Privacy Policy</a>
                    &nbsp;|&nbsp;
                    <a href="${DOMAIN}/refunds" style="color: #5f7f18; text-decoration: none;">Refunds Policy</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

const buildEmailContent = async ({
  email,
  emailType,
  userId,
  securityCode,
  temporaryPassword,
  operatorName,
  companyName,
  adminName,
  trackingId,
  orderStatus,
  orderNote,
  packages,
}: SendEmailPayload, appName: string, businessAddress: string): Promise<EmailContent> => {
  const injectGlobals = (base: Omit<EmailContent, "appName" | "businessAddress">): EmailContent => ({
    ...base,
    appName,
    businessAddress,
  });

  if (emailType === "VERIFY") {
    if (!userId) {
      throw new Error("User id is required for verification emails.");
    }

    const hashedToken = await bcryptjs.hash(userId.toString(), 10);
    await User.findByIdAndUpdate(userId, {
      verifyToken: hashedToken,
      verifyTokenExpiry: Date.now() + 3600000,
    });

    const verifyUrl = `${DOMAIN}/verifyemail?token=${hashedToken}`;

    return injectGlobals({
      subject: `Verify your email for ${appName}`,
      preheader: `Confirm your email address to activate your ${appName} account.`,
      eyebrow: "Email Verification",
      heading: "Activate your account",
      intro: `Welcome to ${appName}. Please verify your email address to complete your account setup.`,
      paragraphs: [
        "Click the button below to confirm your email and continue using your account.",
        "If the button does not open, you can copy and paste the verification link into your browser.",
      ],
      details: [{ label: "Verification link", value: verifyUrl }],
      ctaLabel: "Verify Email",
      ctaUrl: verifyUrl,
      note: "This verification link will expire in 1 hour. If you did not create this account, you can safely ignore this email.",
    });
  }

  if (emailType === "RESET") {
    if (!securityCode) {
      throw new Error("Security code is required for reset emails.");
    }

    return injectGlobals({
      subject: `Your password reset code for ${appName}`,
      preheader: `Use this security code to reset your ${appName} password.`,
      eyebrow: "Password Reset",
      heading: "Reset your password",
      intro: `We received a request to reset the password for your ${appName} account.`,
      paragraphs: [
        "Use the security code below to continue the password reset process.",
      ],
      highlightLabel: "Security Code",
      highlightValue: securityCode,
      note: "This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.",
    });
  }

  if (emailType === "ADMIN_OTP") {
    if (!securityCode) {
      throw new Error("Security code is required for admin access emails.");
    }

    return injectGlobals({
      subject: `Your admin access code for ${appName}`,
      preheader: "Use this one-time code to complete your admin login.",
      eyebrow: "Admin Security",
      heading: "Confirm your admin sign-in",
      intro: "A one-time access code was requested for your admin account.",
      paragraphs: [
        "Enter the code below to complete your admin login securely.",
      ],
      highlightLabel: "Access Code",
      highlightValue: securityCode,
      note: "This code is valid for 10 minutes. If this request was not made by you, please reset your password immediately.",
    });
  }

  if (emailType === "OPERATOR_INVITE") {
    return injectGlobals({
      subject: `Operator invitation from ${appName}`,
      preheader: "You have been invited to join as an operator.",
      eyebrow: "Operator Invitation",
      heading: "You have been invited",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, you have been invited to join ${formatDisplay(companyName, appName)} as an operator.`,
      paragraphs: [
        "Your onboarding request is currently pending admin confirmation.",
        "Once approved, you will receive another email with the next steps for accessing the operator portal.",
      ],
      ctaLabel: "Open Operator Login",
      ctaUrl: `${DOMAIN}/operator/login`,
    });
  }

  if (emailType === "OPERATOR_ACCOUNT_CREATED") {
    if (!temporaryPassword) {
      throw new Error("Temporary password is required for operator account emails.");
    }

    return injectGlobals({
      subject: "Your operator account is ready",
      preheader: "Your operator account has been created and is ready for first login.",
      eyebrow: "Operator Access",
      heading: "Your operator account is ready",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, your operator account for ${formatDisplay(companyName, appName)} has been created.`,
      paragraphs: [
        "Please sign in using the details below and update your password immediately after your first login.",
        "You can also configure Google login later using the same email address.",
      ],
      details: [
        { label: "Login email", value: email },
        { label: "Temporary password", value: temporaryPassword },
      ],
      ctaLabel: "Go to Operator Login",
      ctaUrl: `${DOMAIN}/operator/login`,
      note: "For security reasons, please change your temporary password as soon as you sign in.",
    });
  }

  if (emailType === "OPERATOR_APPROVED") {
    return injectGlobals({
      subject: "Operator request approved",
      preheader: "Your operator request has been approved.",
      eyebrow: "Operator Update",
      heading: "Your request has been approved",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, your operator request for ${formatDisplay(companyName, appName)} has been approved.`,
      paragraphs: [
        "You can now access the operator portal and continue with your assigned operations.",
      ],
      ctaLabel: "Open Operator Login",
      ctaUrl: `${DOMAIN}/operator/login`,
    });
  }

  if (emailType === "OPERATOR_REJECTED") {
    return injectGlobals({
      subject: "Operator request update",
      preheader: "Your operator request was not approved at this time.",
      eyebrow: "Operator Update",
      heading: "Your operator request was not approved",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, your operator request for ${formatDisplay(companyName, appName)} was not approved at this time.`,
      paragraphs: [
        "If you need more information, please contact the company admin or support team.",
      ],
      ctaLabel: "Contact Support",
      ctaUrl: `${DOMAIN}/contact`,
    });
  }

  if (emailType === "OPERATOR_REMOVED_FROM_COMPANY") {
    return injectGlobals({
      subject: "You have been removed from the company",
      preheader: "Your operator association with the company has been removed.",
      eyebrow: "Company Access",
      heading: "Company access removed",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, you have been removed from ${formatDisplay(companyName, "your company")}.`,
      paragraphs: [
        "If you have questions about this change, please contact your company admin.",
        "You can request to join another company from your operator dashboard when needed.",
      ],
      ctaLabel: "Open Operator Dashboard",
      ctaUrl: `${DOMAIN}/operator/login`,
    });
  }

  if (emailType === "OPERATOR_REQUEST_TO_COMPANY") {
    return injectGlobals({
      subject: "New operator request received",
      preheader: "A new operator has requested to join your company.",
      eyebrow: "Company Review",
      heading: "A new operator is awaiting review",
      intro: `Hello ${formatDisplay(adminName, "Admin")}, ${formatDisplay(operatorName, "an operator")} has requested to join ${formatDisplay(companyName, "your company")}.`,
      paragraphs: [
        "Please review the request from your dashboard and approve or reject it when ready.",
      ],
      ctaLabel: "Review in Dashboard",
      ctaUrl: `${DOMAIN}/dashboard/users`,
    });
  }

  if (emailType === "OPERATOR_REQUEST_SUBMITTED") {
    return injectGlobals({
      subject: "Your operator request has been submitted",
      preheader: "Your request has been sent for company review.",
      eyebrow: "Operator Request",
      heading: "Request submitted successfully",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, your join request has been sent to ${formatDisplay(companyName, "the selected company")}.`,
      paragraphs: [
        "You will receive another update once the company admin reviews your request.",
      ],
      ctaLabel: "Open Operator Dashboard",
      ctaUrl: `${DOMAIN}/operator/login`,
    });
  }

  if (emailType === "COMPANY_OFFER_TO_OPERATOR") {
    return injectGlobals({
      subject: "You received a company offer",
      preheader: "A company has invited you to join as an operator.",
      eyebrow: "Company Offer",
      heading: "A company invited you to join",
      intro: `Hello ${formatDisplay(operatorName, "Operator")}, ${formatDisplay(companyName, "a company")} invited you to join as an operator.`,
      paragraphs: [
        "Please sign in to your operator dashboard to review and accept or reject the offer.",
      ],
      ctaLabel: "Review Offer",
      ctaUrl: `${DOMAIN}/operator/login`,
    });
  }

  if (emailType === "OPERATOR_OFFER_ACCEPTED") {
    return injectGlobals({
      subject: "Operator accepted your company offer",
      preheader: "Your operator company offer has been accepted.",
      eyebrow: "Company Offer",
      heading: "Offer accepted",
      intro: `Hello ${formatDisplay(adminName, "Admin")}, ${formatDisplay(operatorName, "the operator")} accepted your offer and is now linked with ${formatDisplay(companyName, "your company")}.`,
      paragraphs: [
        "You can review the operator details from your dashboard.",
      ],
      ctaLabel: "Open Dashboard",
      ctaUrl: `${DOMAIN}/dashboard/users`,
    });
  }

  if (emailType === "OPERATOR_OFFER_REJECTED") {
    return injectGlobals({
      subject: "Operator declined your company offer",
      preheader: "Your operator company offer has been rejected.",
      eyebrow: "Company Offer",
      heading: "Offer rejected",
      intro: `Hello ${formatDisplay(adminName, "Admin")}, ${formatDisplay(operatorName, "the operator")} rejected the offer from ${formatDisplay(companyName, "your company")}.`,
      paragraphs: [
        "You can invite another operator or review pending requests from your dashboard.",
      ],
      ctaLabel: "Open Dashboard",
      ctaUrl: `${DOMAIN}/dashboard/users`,
    });
  }

  if (emailType === "ORDER_CONFIRMED") {
    return injectGlobals({
      subject: "Your order has been confirmed",
      preheader: "Your booking is confirmed and ready to track.",
      eyebrow: "Order Confirmed",
      heading: "Your booking is confirmed",
      intro: `Your ${appName} order has been confirmed successfully.`,
      paragraphs: [
        "You can track the order anytime from your dashboard using the tracking ID below.",
      ],
      details: [{ label: "Tracking ID", value: formatDisplay(trackingId, "Pending") }],
      ctaLabel: "Track Your Order",
      ctaUrl: `${DOMAIN}/login`,
      packages,
    });
  }

  if (emailType === "ORDER_TRACKING_OTP") {
    if (!securityCode) {
      throw new Error("Security code is required for order tracking verification.");
    }

    return injectGlobals({
      subject: "Your order tracking verification code",
      preheader: "Use this code to verify access to order tracking.",
      eyebrow: "Tracking Verification",
      heading: "Verify order tracking access",
      intro: "Use the code below to continue tracking your order securely.",
      paragraphs: [
        "Enter this verification code on the tracking screen to proceed.",
      ],
      details: trackingId ? [{ label: "Tracking ID", value: trackingId }] : [],
      highlightLabel: "Verification Code",
      highlightValue: securityCode,
      note: "This code is valid for 10 minutes.",
    });
  }

  if (emailType === "ORDER_UPDATED") {
    return injectGlobals({
      subject: "Your order has been updated",
      preheader: `There is a new update on your ${appName} order.`,
      eyebrow: "Order Update",
      heading: "Your order details were updated",
      intro: "There is a new update related to your order.",
      paragraphs: [
        "Please review the latest status and notes in your dashboard.",
      ],
      details: [
        { label: "Tracking ID", value: formatDisplay(trackingId, "Pending") },
        { label: "Current status", value: formatOrderStatus(orderStatus) },
        ...(orderNote ? [{ label: "Update note", value: orderNote }] : []),
      ],
      ctaLabel: "View Order Details",
      ctaUrl: `${DOMAIN}/login`,
      packages,
    });
  }

  if (emailType === "ORDER_CANCELLED") {
    return injectGlobals({
      subject: "Your order has been cancelled",
      preheader: `Your ${appName} order has been cancelled.`,
      eyebrow: "Order Cancelled",
      heading: "Your order was cancelled",
      intro: "Your order has been cancelled and the latest order status has been updated.",
      paragraphs: [
        "If you need help understanding the reason or refund status, please contact our support team.",
      ],
      details: [
        { label: "Tracking ID", value: formatDisplay(trackingId, "Pending") },
        ...(orderNote ? [{ label: "Cancellation note", value: orderNote }] : []),
      ],
      ctaLabel: "Contact Support",
      ctaUrl: `${DOMAIN}/contact`,
    });
  }

  throw new Error("Invalid email type");
};

export const wasEmailAccepted = (mailResponse: MailResponseShape) => {
  const acceptedCount = Array.isArray(mailResponse.accepted) ? mailResponse.accepted.length : 0;
  const rejectedCount = Array.isArray(mailResponse.rejected) ? mailResponse.rejected.length : 0;

  return acceptedCount > 0 && rejectedCount === 0;
};

export const sendEmail = async (payload: SendEmailPayload) => {
  try {
    const profile = await CompanyProfile.findOne().lean();
    const appName = profile?.companyName || FALLBACK_APP_NAME;
    const businessAddress = profile?.address || FALLBACK_BUSINESS_ADDRESS;
    const fromNameStr = `${appName} <${DEFAULT_FROM_EMAIL}>`;

    const content = await buildEmailContent(payload, appName, businessAddress);
    const html = buildHtmlTemplate(content);
    const text = toTextLines(content);

    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: fromNameStr,
      replyTo: profile?.supportEmail || REPLY_TO_EMAIL,
      to: payload.email,
      subject: content.subject,
      text,
      html,
    };

    const mailresponse = await transport.sendMail(mailOptions);
    return mailresponse;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Failed to send email.");
  }
};

export const sendOrderConfirmedEmail = async (payload: {
  email: string;
  trackingId?: string;
  packages?: unknown;
}) =>
  sendEmail({
    email: payload.email,
    emailType: "ORDER_CONFIRMED",
    trackingId: payload.trackingId,
    packages: mapOrderPackagesForEmail(payload.packages),
  });
