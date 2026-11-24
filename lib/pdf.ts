import "server-only";

/**
 * Minimal, dependency-free PDF writer for text reports.
 *
 * It produces a valid single-font PDF (Helvetica) with paginated plain-text
 * lines. That is all a statement or compliance export needs, and it avoids
 * adding a heavyweight PDF dependency to the deployment.
 */

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LINE_HEIGHT = 13;
const FONT_SIZE = 9;

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

export function wrapLine(text: string, maxCharacters = 108) {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxCharacters) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function buildPdf(title: string, lines: string[], subtitle?: string): Buffer {
  const usableLines = Math.floor((PAGE_HEIGHT - MARGIN * 2 - 40) / LINE_HEIGHT);
  const body: string[] = [...wrapLine(subtitle ?? "", 108), "", ...lines.flatMap((line) => wrapLine(line, 112))];
  const pages = chunk(body, usableLines);

  // Object layout: 1 catalog, 2 pages, 3 font, then (page, content) pairs.
  const objects: string[] = [];
  const pageNumbers: number[] = [];
  let nextObject = 4;
  const pagePlans = pages.map((pageLines) => {
    const plan = { pageObject: nextObject, contentObject: nextObject + 1, pageLines };
    nextObject += 2;
    return plan;
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pagePlans.map((plan) => `${plan.pageObject} 0 R`).join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pagePlans.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  for (const plan of pagePlans) {
    pageNumbers.push(plan.pageObject);
    objects[plan.pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${plan.contentObject} 0 R >>`;

    let stream = "BT\n";
    stream += `/F1 ${FONT_SIZE + 3} Tf\n${MARGIN} ${PAGE_HEIGHT - MARGIN} Td\n`;
    stream += `(${escapeText(title)}) Tj\n`;
    stream += `/F1 ${FONT_SIZE} Tf\n0 -22 Td\n${LINE_HEIGHT} TL\n`;
    for (const line of plan.pageLines) {
      stream += `(${escapeText(line)}) Tj\nT*\n`;
    }
    stream += "ET";
    objects[plan.contentObject] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  const infoObject = nextObject;
  const createdAt = new Date();
  objects[infoObject] =
    "<< /Title (" + escapeText(title) + ") /Producer (LucidInvest) /CreationDate (D:" +
    createdAt.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z) >>";

  const totalObjects = infoObject + 1;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let index = 1; index < totalObjects; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index} 0 obj\n${objects[index] ?? "<< >>"}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
  for (let index = 1; index < totalObjects; index += 1) {
    pdf += `${String(offsets[index] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
