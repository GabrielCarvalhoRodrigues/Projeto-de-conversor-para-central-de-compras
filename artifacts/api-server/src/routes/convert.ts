import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xls" || ext === ".xlsx") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xls e .xlsx são aceitos."));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseQuantidade(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n);
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function extractOrderNumber(sheet: XLSX.WorkSheet): string {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:Z100");
  for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = String(cell.v ?? "");
      const numMatch = val.match(/\b(\d{10,})\b/);
      if (numMatch) return numMatch[1];
    }
  }
  return "000000000000";
}

function parseSheet(filePath: string, demanda = false): {
  orderNumber: string;
  rows: Array<{ codEmpresa: string; refFabricante: string; quantidade: number }>;
} {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const orderNumber = extractOrderNumber(sheet);

  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  let headerRowIdx = -1;
  let codIdx = -1;
  let refIdx = -1;
  let qtyIdx = -1;

  const codPatterns = [
    /^c[oó]digo\.?$/i,
    /c[oó]d(igo)?\s*(empresa|prod(uto)?|compra)/i,
    /c[oó]d\.?\s*(empresa|prod(uto)?)/i,
    /produto.*empresa/i,
    /empresa.*c[oó]d/i,
    /^c[oó]d\.?$/i,
    /\bitem\b/i,
  ];
  const refPatterns = [
    /ref(er[eê]ncia)?\s*fab(ricante)?/i,
    /fab(ricante)?\s*ref/i,
    /ref\.?\s*fab/i,
    /refer[eê]ncia/i,
    /c[oó]digo.*fab/i,
  ];
  const qtyPatterns = [
    /qtd(e)?\.?/i,
    /quant(idade)?/i,
    /\bqt\b/i,
    /\bqnt\b/i,
    /quantidade/i,
  ];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i].map((c) => String(c ?? "").trim());
    const c = findColumn(row, codPatterns);
    const r = findColumn(row, refPatterns);
    const q = findColumn(row, qtyPatterns);
    if ((c !== -1 || r !== -1) && q !== -1) {
      headerRowIdx = i;
      codIdx = c;
      refIdx = r;
      qtyIdx = q;
      break;
    }
  }

  if (headerRowIdx === -1 || codIdx === -1 || (!demanda && refIdx === -1) || qtyIdx === -1) {
    const missing: string[] = [];
    if (codIdx === -1) missing.push("Código (empresa)");
    if (!demanda && refIdx === -1) missing.push("Referência (fabricante)");
    if (qtyIdx === -1) missing.push("Quantidade");
    const detail =
      missing.length > 0 ? ` Não encontrei: ${missing.join(", ")}.` : "";
    throw new Error(
      `Colunas obrigatórias não encontradas.${detail}`
    );
  }

  const rows: Array<{ codEmpresa: string; refFabricante: string; quantidade: number }> = [];

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    const codEmpresa = codIdx !== -1 ? String(row[codIdx] ?? "").trim() : "";
    const refFabricante = refIdx !== -1 ? String(row[refIdx] ?? "").trim() : "";
    const rawQty = String(row[qtyIdx] ?? "").trim();
    const quantidade = parseQuantidade(rawQty);

    if (demanda ? !codEmpresa : (!codEmpresa && !refFabricante)) continue;
    if (isNaN(quantidade) || quantidade <= 0) continue;

    rows.push({ codEmpresa, refFabricante, quantidade });
  }

  if (rows.length === 0) {
    throw new Error("Planilha vazia ou sem dados válidos após o cabeçalho.");
  }

  return { orderNumber, rows };
}

router.post("/convert", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "Nenhum arquivo enviado." });
    return;
  }

  try {
    req.log.info({ filename: file.originalname }, "Processing file");

    const format = req.body.format ?? "txt";
    if (format !== "txt" && format !== "demanda") {
      throw new Error("Formato de saída inválido.");
    }
    const { orderNumber, rows } = parseSheet(file.path, format === "demanda");

    if (format === "demanda") {
      const escapeCsv = (value: string) =>
        /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      const csv = [
        "Cod;Qtde;Marca;Tipo",
        ...rows.map((r) => `${escapeCsv(r.codEmpresa)};${r.quantidade};1;1`),
      ].join("\r\n") + "\r\n";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      const originalBaseName = path.parse(file.originalname).name;
      res.attachment(`${originalBaseName} CDC.csv`);
      res.send(csv);
      return;
    }

    const prefixedOrder = orderNumber.startsWith("PD_")
      ? orderNumber
      : `PD_${orderNumber}`;

    const txt1Name = `${prefixedOrder} CDC-WEB - COD EMPRESA.txt`;
    const txt2Name = `${prefixedOrder} CDC-WEB - REF FABRICANTE.txt`;
    const txt3Name = `${prefixedOrder} CDC-WEB - COMPLETO.txt`;

    const txt1Lines = rows.map((r) => `${r.codEmpresa};${r.quantidade};1;1`).join("\n");
    const txt2Lines = rows.map((r) => `${r.refFabricante};${r.quantidade};1;1`).join("\n");
    const txt3Lines = rows
      .map((r) => `${r.codEmpresa};${r.quantidade};${r.refFabricante}`)
      .join("\n");

    const zip = new JSZip();
    zip.file(txt1Name, txt1Lines);
    zip.file(txt2Name, txt2Lines);
    zip.file(txt3Name, txt3Lines);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${prefixedOrder} CDC-WEB.zip"`
    );
    res.send(zipBuffer);

    req.log.info({ orderNumber, rowCount: rows.length }, "Conversion successful");
  } catch (err: unknown) {
    req.log.error({ err }, "Conversion error");
    const message = err instanceof Error ? err.message : "Erro interno na conversão.";
    if (!res.headersSent) {
      res.status(422).json({ error: message });
    }
  } finally {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
});

export default router;
