import { Router, Request, Response } from "express";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/plain" ||
      file.originalname.endsWith(".pdf") ||
      file.originalname.endsWith(".txt");
    cb(null, ok);
  },
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n");
}

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    let text = "";
    if (req.file.mimetype === "application/pdf" || req.file.originalname.endsWith(".pdf")) {
      text = await extractPdfText(req.file.buffer);
    } else {
      text = req.file.buffer.toString("utf-8");
    }

    text = text.trim().substring(0, 8000);
    return res.json({ text, filename: req.file.originalname });
  } catch (err: any) {
    console.error("Upload parsing failed:", err.message);
    return res.status(500).json({ error: "Failed to parse file", detail: err.message });
  }
});

export default router;