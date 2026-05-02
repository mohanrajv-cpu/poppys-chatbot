import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { sql } from './db';

interface POData {
  po_number: string;
  po_date: string;
  delivery_date: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_email: string | null;
  vendor_gst: string | null;
  place_of_delivery: string;
  currency: string;
  conversion_rate: number | null;
  terms_of_delivery: string | null;
  pay_terms: string | null;
}

interface LineItem {
  sno: number;
  acc_name: string | null;
  style_no: string | null;
  colour_code: string;
  colour_name: string;
  size: string | null;
  uom: string;
  qty: number;
  rate: number | null;
}

// Drawing helpers
const COLORS = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.2, 0.2, 0.2),
  gray: rgb(0.5, 0.5, 0.5),
  lightGray: rgb(0.85, 0.85, 0.85),
  headerBg: rgb(0.92, 0.92, 0.92),
  white: rgb(1, 1, 1),
  green: rgb(0.15, 0.35, 0.15),
  border: rgb(0.3, 0.3, 0.3),
};

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, opts?: { fill?: typeof COLORS.black; stroke?: typeof COLORS.black; strokeWidth?: number }) {
  if (opts?.fill) {
    page.drawRectangle({ x, y, width: w, height: h, color: opts.fill });
  }
  if (opts?.stroke) {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: opts.stroke, borderWidth: opts?.strokeWidth || 0.5 });
  }
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = COLORS.black) {
  page.drawText(text || '', { x, y, size, font, color });
}

function drawTextRight(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, maxWidth: number, color = COLORS.black) {
  const tw = font.widthOfTextAtSize(text || '', size);
  page.drawText(text || '', { x: x + maxWidth - tw, y, size, font, color });
}

function drawTextCenter(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, maxWidth: number, color = COLORS.black) {
  const tw = font.widthOfTextAtSize(text || '', size);
  page.drawText(text || '', { x: x + (maxWidth - tw) / 2, y, size, font, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: COLORS.border });
}

// Wrap text into lines that fit within maxWidth
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function generatePOPdf(poId: number): Promise<Uint8Array> {
  // Fetch PO data
  const poResult = await sql`SELECT * FROM pos WHERE id = ${poId}`;
  const po = poResult.rows[0] as POData;

  const itemsResult = await sql`SELECT * FROM po_line_items WHERE po_id = ${poId} ORDER BY sno`;
  const items = itemsResult.rows as LineItem[];

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const page = doc.addPage([pageWidth, pageHeight]);

  let y = pageHeight - margin;

  // === OUTER BORDER ===
  drawRect(page, margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, { stroke: COLORS.border, strokeWidth: 1 });

  // === COMPANY HEADER ===
  const headerTop = y;
  y -= 5;

  // Company name
  drawTextCenter(page, 'POPPYS KNITWEAR PRIVATE LIMITED', margin, y - 15, fontBold, 14, contentWidth * 0.65);
  // Address
  drawTextCenter(page, 'NO:9 M.P.NAGAR, TIRUPUR - 641607  TAMIL NADU', margin, y - 30, fontRegular, 8, contentWidth * 0.65);
  // GST
  drawTextCenter(page, 'GST NO : 33AADFP4476C1ZH', margin, y - 42, fontRegular, 8, contentWidth * 0.65);

  // Right side - PO details box
  const rightBoxX = margin + contentWidth * 0.65;
  const rightBoxW = contentWidth * 0.35;
  drawRect(page, rightBoxX, y - 55, rightBoxW, 55, { stroke: COLORS.border });

  // "ACCESSORIES PURCHASE ORDER" header
  drawTextCenter(page, 'ACCESSORIES PURCHASE ORDER', rightBoxX, y - 12, fontBold, 9, rightBoxW);

  drawLine(page, rightBoxX, y - 16, rightBoxX + rightBoxW, y - 16);
  drawTextCenter(page, 'PO NO', rightBoxX, y - 26, fontBold, 8, rightBoxW);
  drawLine(page, rightBoxX, y - 30, rightBoxX + rightBoxW, y - 30);
  drawTextCenter(page, po.po_number, rightBoxX, y - 42, fontBold, 10, rightBoxW, COLORS.green);
  drawLine(page, rightBoxX, y - 55, rightBoxX + rightBoxW, y - 55);

  y -= 60;

  // Delivery date, terms row
  drawRect(page, rightBoxX, y - 45, rightBoxW, 45, { stroke: COLORS.border });
  drawText(page, `DELIVERY DATE : ${po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('en-GB') : '---'}`, rightBoxX + 5, y - 12, fontRegular, 8);
  drawText(page, `TERMS OF DELIVERY :`, rightBoxX + 5, y - 24, fontBold, 7);
  drawText(page, po.terms_of_delivery || '---', rightBoxX + 5, y - 34, fontRegular, 7);
  drawText(page, `Pay Terms : ${po.pay_terms || '---'}`, rightBoxX + 5, y - 44, fontRegular, 7);

  // === VENDOR SECTION ===
  const vendorBoxY = y;
  const vendorBoxH = 45;
  const vendorLeftW = contentWidth * 0.38;
  const vendorMidW = contentWidth * 0.27;

  // Vendor left
  drawRect(page, margin, vendorBoxY - vendorBoxH, vendorLeftW, vendorBoxH, { stroke: COLORS.border });
  drawText(page, 'VENDOR :', margin + 5, vendorBoxY - 12, fontBold, 8);
  drawText(page, po.vendor_name || '---', margin + 5, vendorBoxY - 24, fontBold, 9);
  const addrLines = wrapText(po.vendor_address || '', fontRegular, 7, vendorLeftW - 10);
  addrLines.forEach((line, i) => {
    drawText(page, line, margin + 5, vendorBoxY - 34 - i * 9, fontRegular, 7);
  });

  // Vendor middle (email, GST)
  drawRect(page, margin + vendorLeftW, vendorBoxY - vendorBoxH, vendorMidW, vendorBoxH, { stroke: COLORS.border });
  drawText(page, `EMAIL : ${po.vendor_email || '---'}`, margin + vendorLeftW + 5, vendorBoxY - 12, fontRegular, 7);
  drawText(page, `GST No : ${po.vendor_gst || '---'}`, margin + vendorLeftW + 5, vendorBoxY - 24, fontRegular, 7);

  y -= vendorBoxH;

  // === PLACE OF DELIVERY / CURRENCY ROW ===
  const delBoxH = 38;
  const delLeftW = contentWidth * 0.65;
  const delRightW = contentWidth * 0.35;

  drawRect(page, margin, y - delBoxH, delLeftW, delBoxH, { stroke: COLORS.border });
  drawText(page, 'PLACE OF DELIVERY : ' + (po.place_of_delivery || 'POPPYS KNITWEAR [PADIYUR]'), margin + 5, y - 12, fontBold, 7);
  drawText(page, 'SF NO 27 MEENAKSHI VALASU MARUDURAAIYAN VALASU(PO)', margin + 5, y - 22, fontRegular, 7);
  drawText(page, 'KANDIYAN KOVIL VILLAGE TIRUPUR', margin + 5, y - 32, fontRegular, 7);

  drawRect(page, margin + delLeftW, y - delBoxH, delRightW, delBoxH, { stroke: COLORS.border });
  drawText(page, `Currency : ${po.currency || 'INR'}`, margin + delLeftW + 5, y - 12, fontRegular, 8);
  drawText(page, `Convrate : ${po.conversion_rate || '---'}`, margin + delLeftW + 5, y - 26, fontRegular, 8);

  y -= delBoxH;

  // === TABLE HEADER ===
  const cols = [
    { label: 'SNo', w: 30 },
    { label: 'ACC NAME', w: 90 },
    { label: 'OC NO /\nSTYLE NO', w: 100 },
    { label: 'DESCRIPTION /\nSHADENO', w: 100 },
    { label: 'COLOR/\nSIZES', w: 140 },
    { label: 'UOM', w: 40 },
    { label: 'PO QTY', w: 80 },
    { label: 'RATE', w: contentWidth - 30 - 90 - 100 - 100 - 140 - 40 - 80 },
  ];

  const tableHeaderH = 28;
  drawRect(page, margin, y - tableHeaderH, contentWidth, tableHeaderH, { fill: COLORS.headerBg, stroke: COLORS.border });

  let colX = margin;
  for (const col of cols) {
    const lines = col.label.split('\n');
    lines.forEach((line, i) => {
      drawText(page, line, colX + 3, y - 10 - i * 10, fontBold, 7);
    });
    colX += col.w;
    if (col !== cols[cols.length - 1]) {
      drawLine(page, colX, y, colX, y - tableHeaderH);
    }
  }

  y -= tableHeaderH;

  // === TABLE ROWS ===
  let totalQty = 0;
  let totalAmount = 0;

  for (const item of items) {
    const rowH = 30;

    // Check if we need a new page
    if (y - rowH < margin + 80) {
      // Not adding new pages for demo — just stop
      break;
    }

    drawRect(page, margin, y - rowH, contentWidth, rowH, { stroke: COLORS.border });

    colX = margin;

    // SNo
    drawTextCenter(page, String(item.sno), colX, y - 12, fontRegular, 8, cols[0].w);
    colX += cols[0].w;
    drawLine(page, colX, y, colX, y - rowH);

    // ACC NAME
    drawText(page, item.acc_name || '', colX + 3, y - 12, fontRegular, 8);
    colX += cols[1].w;
    drawLine(page, colX, y, colX, y - rowH);

    // OC NO / STYLE NO
    const styleLines = wrapText(item.style_no || '', fontRegular, 7, cols[2].w - 6);
    styleLines.forEach((line, i) => {
      drawText(page, line, colX + 3, y - 12 - i * 9, fontRegular, 7);
    });
    colX += cols[2].w;
    drawLine(page, colX, y, colX, y - rowH);

    // DESCRIPTION / SHADENO (colour code)
    drawText(page, item.colour_code, colX + 3, y - 12, fontRegular, 8);
    colX += cols[3].w;
    drawLine(page, colX, y, colX, y - rowH);

    // COLOR / SIZES
    const colorSize = item.size ? `${item.colour_name} / ${item.size}` : item.colour_name;
    const csLines = wrapText(colorSize, fontRegular, 7, cols[4].w - 6);
    csLines.forEach((line, i) => {
      drawText(page, line, colX + 3, y - 12 - i * 9, fontRegular, 7);
    });
    colX += cols[4].w;
    drawLine(page, colX, y, colX, y - rowH);

    // UOM
    drawTextCenter(page, item.uom, colX, y - 12, fontRegular, 8, cols[5].w);
    colX += cols[5].w;
    drawLine(page, colX, y, colX, y - rowH);

    // PO QTY
    drawTextRight(page, item.qty.toLocaleString('en-IN', { minimumFractionDigits: 3 }), colX, y - 12, fontRegular, 8, cols[6].w - 5);
    totalQty += item.qty;
    colX += cols[6].w;
    drawLine(page, colX, y, colX, y - rowH);

    // RATE
    const rate = item.rate != null ? item.rate.toFixed(4) : '---';
    drawTextRight(page, rate, colX, y - 12, fontRegular, 8, cols[7].w - 5);
    if (item.rate != null) totalAmount += item.qty * item.rate;

    y -= rowH;
  }

  // === TOTAL ROW ===
  const totalRowH = 20;
  drawRect(page, margin, y - totalRowH, contentWidth, totalRowH, { stroke: COLORS.border });

  // "TOTAL" label
  const totalLabelX = margin + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
  drawTextRight(page, 'TOTAL', margin, y - 14, fontBold, 9, totalLabelX - margin - 5);

  // Total QTY
  const qtyX = totalLabelX + cols[5].w;
  drawLine(page, totalLabelX, y, totalLabelX, y - totalRowH);
  drawLine(page, qtyX, y, qtyX, y - totalRowH);
  drawTextRight(page, totalQty.toLocaleString('en-IN', { minimumFractionDigits: 3 }), qtyX, y - 14, fontBold, 8, cols[6].w - 5);

  y -= totalRowH;

  // === GROSS / GRAND TOTAL ROW ===
  const grossRowH = 18;
  drawRect(page, margin, y - grossRowH, contentWidth, grossRowH, { stroke: COLORS.border });
  drawText(page, 'PURCHASE BUTTON, ZIP, TAPE, LACE, etc.', margin + 5, y - 13, fontRegular, 7);
  drawTextRight(page, 'GROSS', margin + contentWidth * 0.5, y - 13, fontBold, 8, contentWidth * 0.2);
  y -= grossRowH;

  const grandRowH = 20;
  drawRect(page, margin, y - grandRowH, contentWidth, grandRowH, { stroke: COLORS.border });
  drawTextRight(page, 'Grand Total', margin, y - 14, fontBold, 10, contentWidth - 10);
  y -= grandRowH;

  // === NOTE ===
  y -= 8;
  drawText(page, 'Note : Please mention the above PO No and Order Ref in all your corresponding challens, Bills etc..,', margin + 5, y, fontBold, 7);
  y -= 14;

  // === TERMS & CONDITIONS ===
  drawText(page, 'Terms & Conditions', margin + 5, y, fontBold, 8);
  y -= 12;
  drawText(page, '1  KINDLY QUOTE IN YOUR INVOICES. IF YOUR COMPANY IS REGISTERED UNDER MSME.', margin + 5, y, fontRegular, 7);

  const pdfBytes = await doc.save();
  return pdfBytes;
}
