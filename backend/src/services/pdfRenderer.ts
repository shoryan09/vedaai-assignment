import PDFDocument from "pdfkit";
import type { IAssignment } from "../models/Assignment";

const COLOR = {
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  easyBg: "#f0fdf4",
  easyFg: "#15803d",
  modBg: "#fffbeb",
  modFg: "#b45309",
  hardBg: "#fef2f2",
  hardFg: "#b91c1c",
};

const badgeFor = (d: "easy" | "moderate" | "hard") => {
  if (d === "easy") return { bg: COLOR.easyBg, fg: COLOR.easyFg, label: "Easy" };
  if (d === "moderate") return { bg: COLOR.modBg, fg: COLOR.modFg, label: "Moderate" };
  return { bg: COLOR.hardBg, fg: COLOR.hardFg, label: "Challenging" };
};

export const renderPaperToBuffer = (assignment: IAssignment): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const paper = assignment.generatedPaper;
      if (!paper) {
        reject(new Error("No generated paper to render"));
        return;
      }

      // School header
      doc
        .fillColor(COLOR.text)
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("Delhi Public School, Sector-4, Bokaro", { align: "center" });
      doc
        .moveDown(0.3)
        .font("Helvetica")
        .fontSize(11)
        .text(`Subject: ${assignment.title}`, { align: "center" })
        .text("Class: 8th", { align: "center" });

      doc.moveDown(0.8);
      doc
        .strokeColor(COLOR.border)
        .lineWidth(0.5)
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.8);

      // Time + Marks
      const startY = doc.y;
      doc.fontSize(11).text("Time Allowed: 45 minutes", { continued: false });
      doc.text(`Maximum Marks: ${paper.totalMarks}`, doc.page.width - doc.page.margins.right - 120, startY, {
        align: "left",
      });
      doc.x = doc.page.margins.left;
      doc.moveDown(0.5);

      doc.text("All questions are compulsory unless stated otherwise.");
      doc.moveDown(0.8);

      // Student info lines
      const drawLine = (label: string, width = 200) => {
        const y = doc.y + 12;
        doc.font("Helvetica").fontSize(11).text(label, { continued: true });
        const lineStartX = doc.x;
        doc
          .strokeColor("#9ca3af")
          .lineWidth(0.5)
          .moveTo(lineStartX, y)
          .lineTo(lineStartX + width, y)
          .stroke();
        doc.text(" ");
      };

      drawLine("Name:");
      drawLine("Roll Number:");
      doc.font("Helvetica").fontSize(11).text("Class: 5th    Section: ___________");
      doc.moveDown(1);

      // Sections
      let counter = 0;
      paper.sections.forEach((section) => {
        // Check page break
        if (doc.y > doc.page.height - 200) doc.addPage();

        doc.font("Helvetica-Bold").fontSize(12).text(section.title, { align: "center" });
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLOR.muted).text(section.instruction, { align: "center" });
        doc.fillColor(COLOR.text);
        doc.moveDown(0.6);

        section.questions.forEach((q) => {
          counter++;
          if (doc.y > doc.page.height - 100) doc.addPage();

          const b = badgeFor(q.difficulty);
          const xStart = doc.page.margins.left;
          const y = doc.y;

          // Question number
          doc.font("Helvetica").fontSize(11).fillColor(COLOR.text).text(`${counter}.`, xStart, y, { continued: false });

          // Badge
          const badgeX = xStart + 22;
          const badgeY = y;
          const badgeWidth = doc.widthOfString(b.label) + 10;
          const badgeHeight = 14;

          doc.roundedRect(badgeX, badgeY - 2, badgeWidth, badgeHeight, 3).fillAndStroke(b.bg, b.bg);
          doc.fillColor(b.fg).font("Helvetica-Bold").fontSize(8).text(b.label, badgeX + 5, badgeY + 1);

          // Question text
          const textX = badgeX + badgeWidth + 6;
          const textWidth = doc.page.width - doc.page.margins.right - textX - 60;
          doc.fillColor(COLOR.text).font("Helvetica").fontSize(11).text(q.text, textX, y, {
            width: textWidth,
          });
          const textEndY = doc.y;

          // Marks (right-aligned)
          doc.fillColor(COLOR.muted).fontSize(9).text(`[${q.marks} Marks]`, doc.page.width - doc.page.margins.right - 55, y);
          doc.fillColor(COLOR.text);

          doc.y = textEndY;
          doc.x = doc.page.margins.left;
          doc.moveDown(0.4);
        });

        doc.moveDown(0.6);
      });

      doc.font("Helvetica-Bold").fontSize(11).text("End of Question Paper");
      doc.moveDown(0.8);

      // Answer key
      if (paper.answerKey) {
        if (doc.y > doc.page.height - 150) doc.addPage();
        doc
          .strokeColor(COLOR.border)
          .lineWidth(0.5)
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text("Answer Key:");
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(11).text(paper.answerKey, { paragraphGap: 4 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};