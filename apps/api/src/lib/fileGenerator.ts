/**
 * fileGenerator.ts
 *
 * Centralised file-generation utilities for:
 *   - Experience letters  (PDF, DOCX)
 *   - Payroll exports     (Excel, PDF, DOCX)
 *
 * All functions write files to `apps/api/uploads/` and return the relative
 * URL path that `express.static("/uploads", ...)` will serve.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads");

// ─── Experience Letter Types ──────────────────────────────────────────────────

export interface LetterData {
  fullName: string;
  positionTitle: string;
  hireDate: Date;
  endDate: Date;
  duration: string;
  generatedAt: Date;
}

// ─── Payroll Export Types ─────────────────────────────────────────────────────

export interface SalaryRow {
  employeeId: string;
  fullName: string;
  baseSalary: number;
  bonus: number;
  penalty: number;
  netPay: number;
}

// ─── Experience Letter — PDF ──────────────────────────────────────────────────

export function writeLetterPDF(filename: string, data: LetterData): Promise<string> {
  const dest = path.join(uploadsRoot, "letters", filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: "A4" });
    const stream = fs.createWriteStream(dest);
    doc.pipe(stream);

    // Header
    doc.fontSize(18).font("Helvetica-Bold")
      .text("BAHIR DAR UNIVERSITY", { align: "center" });
    doc.fontSize(13).font("Helvetica")
      .text("Human Resources Department", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke();
    doc.moveDown();

    // Title
    doc.fontSize(14).font("Helvetica-Bold")
      .text("EXPERIENCE LETTER", { align: "center", underline: true });
    doc.moveDown();

    // Date
    doc.fontSize(11).font("Helvetica")
      .text(`Date: ${data.generatedAt.toDateString()}`, { align: "right" });
    doc.moveDown();

    // Body
    doc.fontSize(11).font("Helvetica").text(
      `To Whom It May Concern,`,
    );
    doc.moveDown(0.5);
    doc.text(
      `This is to certify that `,
      { continued: true }
    );
    doc.font("Helvetica-Bold").text(data.fullName, { continued: true });
    doc.font("Helvetica").text(
      ` has served Bahir Dar University in the capacity of ` +
      `${data.positionTitle} from ${data.hireDate.toDateString()} ` +
      `to ${data.endDate.toDateString()}, a total duration of ${data.duration}.`,
    );
    doc.moveDown();
    doc.text(
      "During their tenure, they performed their duties diligently and professionally. " +
      "We wish them every success in their future endeavours."
    );

    // Signature block
    doc.moveDown(4);
    doc.text("_______________________");
    doc.text("Human Resources Officer");
    doc.font("Helvetica-Bold").text("Bahir Dar University");

    doc.end();
    stream.on("finish", () => resolve(`/uploads/letters/${filename}`));
    stream.on("error", reject);
  });
}

// ─── Experience Letter — DOCX ─────────────────────────────────────────────────

export async function writeLetterDOCX(filename: string, data: LetterData): Promise<string> {
  const dest = path.join(uploadsRoot, "letters", filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "BAHIR DAR UNIVERSITY",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Human Resources Department",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "EXPERIENCE LETTER",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.END,
            children: [new TextRun(`Date: ${data.generatedAt.toDateString()}`)],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun("To Whom It May Concern,")] }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun("This is to certify that "),
              new TextRun({ text: data.fullName, bold: true }),
              new TextRun(
                ` has served Bahir Dar University in the capacity of ` +
                `${data.positionTitle} from ${data.hireDate.toDateString()} ` +
                `to ${data.endDate.toDateString()}, a total duration of ${data.duration}.`
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun(
                "During their tenure, they performed their duties diligently and professionally. " +
                "We wish them every success in their future endeavours."
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun("_______________________")] }),
          new Paragraph({ children: [new TextRun("Human Resources Officer")] }),
          new Paragraph({ children: [new TextRun({ text: "Bahir Dar University", bold: true })] }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(dest, buffer);
  return `/uploads/letters/${filename}`;
}

// ─── Payroll Export — Excel ───────────────────────────────────────────────────

export async function writePayrollExcel(
  filename: string,
  period: string,
  rows: SalaryRow[]
): Promise<string> {
  const dest = path.join(uploadsRoot, "exports", filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = "HRMS – Bahir Dar University";
  wb.created = new Date();

  const ws = wb.addWorksheet(`Payroll ${period}`);

  // Title row
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `Payroll Report – ${period}`;
  ws.getCell("A1").font = { size: 14, bold: true };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.addRow([]);

  // Header row
  ws.columns = [
    { key: "employeeId", width: 22 },
    { key: "fullName",   width: 32 },
    { key: "baseSalary", width: 16 },
    { key: "bonus",      width: 14 },
    { key: "penalty",    width: 14 },
    { key: "netPay",     width: 16 },
  ];

  const headerRow = ws.addRow([
    "Employee ID", "Full Name", "Base Salary (ETB)", "Bonus (ETB)", "Penalty (ETB)", "Net Pay (ETB)",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center" };
  });

  // Data rows
  rows.forEach(r => {
    const row = ws.addRow([r.employeeId, r.fullName, r.baseSalary, r.bonus, r.penalty, r.netPay]);
    row.getCell(3).numFmt = "#,##0.00";
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "#,##0.00";
  });

  // Totals row
  if (rows.length > 0) {
    const totals = ws.addRow([
      "", "TOTAL",
      rows.reduce((s, r) => s + r.baseSalary, 0),
      rows.reduce((s, r) => s + r.bonus, 0),
      rows.reduce((s, r) => s + r.penalty, 0),
      rows.reduce((s, r) => s + r.netPay, 0),
    ]);
    totals.font = { bold: true };
    // ExcelJS border style uses string literals, not the docx BorderStyle enum
    totals.eachCell(cell => {
      cell.border = { top: { style: "thin" } };
    });
  }

  await wb.xlsx.writeFile(dest);
  return `/uploads/exports/${filename}`;
}

// ─── Payroll Export — PDF ─────────────────────────────────────────────────────

export function writePayrollPDF(
  filename: string,
  period: string,
  rows: SalaryRow[]
): Promise<string> {
  const dest = path.join(uploadsRoot, "exports", filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });
    const stream = fs.createWriteStream(dest);
    doc.pipe(stream);

    // Title
    doc.fontSize(16).font("Helvetica-Bold")
      .text(`Payroll Report – ${period}`, { align: "center" });
    doc.fontSize(10).font("Helvetica")
      .text(`Generated: ${new Date().toDateString()}`, { align: "center" });
    doc.moveDown();

    // Column widths
    const cols = [120, 160, 90, 80, 80, 90];
    const headers = ["Employee ID", "Full Name", "Base Salary", "Bonus", "Penalty", "Net Pay"];

    let x = 50;
    const startY = doc.y;

    // Header row
    doc.font("Helvetica-Bold").fontSize(9);
    headers.forEach((h, i) => {
      doc.text(h, x, startY, { width: cols[i], align: "center" });
      x += cols[i];
    });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.3);

    // Data rows
    doc.font("Helvetica").fontSize(8);
    rows.forEach(r => {
      const y = doc.y;
      let cx = 50;
      [r.employeeId, r.fullName,
        r.baseSalary.toFixed(2), r.bonus.toFixed(2),
        r.penalty.toFixed(2), r.netPay.toFixed(2)].forEach((v, i) => {
        doc.text(String(v), cx, y, { width: cols[i], align: i >= 2 ? "right" : "left" });
        cx += cols[i];
      });
      doc.moveDown(0.4);
    });

    // Totals
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.3);
    const ty = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("TOTAL", 50, ty, { width: cols[0] + cols[1], align: "right" });
    let cx = 50 + cols[0] + cols[1];
    [
      rows.reduce((s, r) => s + r.baseSalary, 0).toFixed(2),
      rows.reduce((s, r) => s + r.bonus, 0).toFixed(2),
      rows.reduce((s, r) => s + r.penalty, 0).toFixed(2),
      rows.reduce((s, r) => s + r.netPay, 0).toFixed(2),
    ].forEach((v, i) => {
      doc.text(v, cx, ty, { width: cols[i + 2], align: "right" });
      cx += cols[i + 2];
    });

    doc.end();
    stream.on("finish", () => resolve(`/uploads/exports/${filename}`));
    stream.on("error", reject);
  });
}

// ─── Payroll Export — DOCX ────────────────────────────────────────────────────

export async function writePayrollDOCX(
  filename: string,
  period: string,
  rows: SalaryRow[]
): Promise<string> {
  const dest = path.join(uploadsRoot, "exports", filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const headerCells = ["Employee ID", "Full Name", "Base Salary", "Bonus", "Penalty", "Net Pay"]
    .map(h =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: "1565C0", color: "FFFFFF" },
      })
    );

  const dataRows = rows.map(r =>
    new TableRow({
      children: [
        r.employeeId, r.fullName,
        r.baseSalary.toFixed(2), r.bonus.toFixed(2),
        r.penalty.toFixed(2), r.netPay.toFixed(2),
      ].map(v => new TableCell({ children: [new Paragraph({ children: [new TextRun(String(v))] })] })),
    })
  );

  const totalRow = new TableRow({
    children: [
      "", "TOTAL",
      rows.reduce((s, r) => s + r.baseSalary, 0).toFixed(2),
      rows.reduce((s, r) => s + r.bonus, 0).toFixed(2),
      rows.reduce((s, r) => s + r.penalty, 0).toFixed(2),
      rows.reduce((s, r) => s + r.netPay, 0).toFixed(2),
    ].map(v =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(v), bold: true })] })],
      })
    ),
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `Payroll Report – ${period}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun(`Generated: ${new Date().toDateString()}`)],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: headerCells, tableHeader: true }),
              ...dataRows,
              totalRow,
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(dest, buffer);
  return `/uploads/exports/${filename}`;
}
