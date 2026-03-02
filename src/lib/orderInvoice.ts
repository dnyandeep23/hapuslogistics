import appLogo from "@/assets/images/applogo.png";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const stringified = maybeToString.call(value);
      if (stringified && stringified !== "[object Object]") return stringified;
    }
  }
  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: unknown): string {
  const raw = toStringValue(value);
  const date = new Date(raw);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: unknown): string {
  const amount = toNumberValue(value, 0);
  return `Rs ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function mapLocation(value: unknown): { name: string; address: string } {
  if (!isRecord(value)) return { name: "--", address: "--" };
  const name = toStringValue(value.name, "--");
  const address = [value.address, value.city, value.state, value.zip]
    .map((part) => toStringValue(part))
    .filter(Boolean)
    .join(", ");
  return { name, address: address || "--" };
}

function mapPerson(value: unknown): { name: string; phone: string } {
  if (!isRecord(value)) return { name: "--", phone: "--" };
  return {
    name:
      toStringValue(value.name) ||
      toStringValue(value.senderName) ||
      toStringValue(value.receiverName) ||
      "--",
    phone:
      toStringValue(value.phone) ||
      toStringValue(value.contact) ||
      toStringValue(value.senderContact) ||
      toStringValue(value.receiverContact) ||
      "--",
  };
}

function mapPackages(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((item) => isRecord(item)) : [];
}

function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "invoice";
}

function toMultilineText(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || "--";
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (trial.length > maxLen) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read logo image"));
    reader.readAsDataURL(blob);
  });
}

async function getLogoDataUrl(): Promise<string | null> {
  try {
    const src = typeof appLogo === "string" ? appLogo : appLogo.src;
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await readBlobAsDataUrl(blob);
  } catch {
    return null;
  }
}

interface InvoiceData {
  orderId: string;
  trackingId: string;
  status: string;
  orderDate: string;
  totalAmount: string;
  totalWeight: string;
  pickup: { name: string; address: string };
  drop: { name: string; address: string };
  sender: { name: string; phone: string };
  receiver: { name: string; phone: string };
  packages: UnknownRecord[];
}

function buildInvoiceData(order: unknown): InvoiceData {
  const data = isRecord(order) ? order : {};
  return {
    orderId: toStringValue(data.id || data._id, "--"),
    trackingId: toStringValue(data.trackingId, "TRACKING-PENDING"),
    status: toStringValue(data.status, "pending"),
    orderDate: formatDate(data.orderDate || data.createdAt),
    totalAmount: formatMoney(data.totalAmount),
    totalWeight: `${toNumberValue(data.totalWeightKg)} kg`,
    pickup: mapLocation(data.pickupLocation),
    drop: mapLocation(data.dropLocation),
    sender: mapPerson(data.senderInfo),
    receiver: mapPerson(data.receiverInfo),
    packages: mapPackages(data.packages),
  };
}

export async function downloadOrderInvoice(order: unknown): Promise<string> {
  const [{ jsPDF }, autoTableModule, logoDataUrl] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    getLogoDataUrl(),
  ]);

  const autoTable = autoTableModule.default;
  const invoice = buildInvoiceData(order);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  doc.setFillColor(248, 250, 245);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 26, 56, 56, undefined, "FAST");
  }

  doc.setTextColor(28, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Hapus Logistics", margin + 68, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text("TAX INVOICE", margin + 68, 69);

  doc.setDrawColor(210, 220, 180);
  doc.setLineWidth(1);
  doc.line(margin, 92, pageWidth - margin, 92);

  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(35, 35, 35);
  doc.text(`Invoice Date: ${invoice.orderDate}`, rightX, 45, { align: "right" });
  doc.text(`Order ID: ${invoice.orderId}`, rightX, 61, { align: "right" });
  doc.text(`Tracking ID: ${invoice.trackingId}`, rightX, 77, { align: "right" });
  doc.text(`Status: ${invoice.status}`, rightX, 93, { align: "right" });

  const cardY = 112;
  const cardGap = 10;
  const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
  const cardHeight = 58;

  const drawCard = (x: number, title: string, value: string) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 225, 210);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 8, 8, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(105, 105, 105);
    doc.text(title, x + 10, cardY + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(value, x + 10, cardY + 40);
  };

  drawCard(margin, "Total Amount", invoice.totalAmount);
  drawCard(margin + cardWidth + cardGap, "Total Weight", invoice.totalWeight);
  drawCard(margin + (cardWidth + cardGap) * 2, "Packages", String(invoice.packages.length));

  const boxY = cardY + cardHeight + 16;
  const boxGap = 12;
  const boxWidth = (pageWidth - margin * 2 - boxGap) / 2;
  const boxHeight = 84;

  const drawInfoBox = (x: number, title: string, name: string, line2: string) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 225, 210);
    doc.roundedRect(x, boxY, boxWidth, boxHeight, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(title, x + 10, boxY + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    doc.text(toMultilineText(name, 42), x + 10, boxY + 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    doc.text(toMultilineText(line2, 46), x + 10, boxY + 52);
  };

  drawInfoBox(margin, "Pickup", invoice.pickup.name, invoice.pickup.address);
  drawInfoBox(margin + boxWidth + boxGap, "Drop", invoice.drop.name, invoice.drop.address);

  const personBoxY = boxY + boxHeight + 10;
  const personBoxHeight = 68;

  const drawPersonBox = (x: number, title: string, person: { name: string; phone: string }) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 225, 210);
    doc.roundedRect(x, personBoxY, boxWidth, personBoxHeight, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(title, x + 10, personBoxY + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    doc.text(toMultilineText(person.name, 40), x + 10, personBoxY + 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(85, 85, 85);
    doc.text(person.phone, x + 10, personBoxY + 50);
  };

  drawPersonBox(margin, "Sender", invoice.sender);
  drawPersonBox(margin + boxWidth + boxGap, "Receiver", invoice.receiver);

  const tableStartY = personBoxY + personBoxHeight + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("Package Details", margin, tableStartY - 8);

  const tableBody =
    invoice.packages.length > 0
      ? invoice.packages.map((pkg, index) => {
          const name =
            toStringValue(pkg.packageName) ||
            toStringValue(pkg.description) ||
            `Package ${index + 1}`;
          const qty = String(toNumberValue(pkg.packageQuantities ?? pkg.quantity, 1));
          const weight = `${toNumberValue(pkg.packageWeight ?? pkg.weightKg, 0)} kg`;
          const type = toStringValue(pkg.packageType, "--");
          const size = toStringValue(pkg.packageSize, "--");
          return [String(index + 1), name, type, size, qty, weight];
        })
      : [["-", "No package details available", "-", "-", "-", "-"]];

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Package", "Type", "Size", "Qty", "Weight"]],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [35, 35, 35],
      lineColor: [220, 225, 210],
      lineWidth: 0.5,
      valign: "middle",
    },
    headStyles: {
      fillColor: [205, 214, 69],
      textColor: [20, 20, 20],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 251, 247],
    },
    theme: "grid",
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  const footerY = typeof finalY === "number" ? Math.max(finalY + 24, pageHeight - 40) : pageHeight - 40;
  doc.setDrawColor(210, 220, 180);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, margin, footerY);
  doc.text("This is a computer-generated invoice.", pageWidth - margin, footerY, { align: "right" });

  const fileName = sanitizeFileName(`invoice-${invoice.trackingId || invoice.orderId}.pdf`);
  doc.save(fileName);
  return fileName;
}
