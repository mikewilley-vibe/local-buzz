import { logDevTiming } from "@/lib/dev-log";

const OFFICE_REL_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const SPREADSHEET_NS =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

const MAX_ZIP_ENTRIES = 64;
const MAX_UNCOMPRESSED_FILE_BYTES = 8_388_608;
const MAX_EOCD_SCAN_BYTES = 65_557;
const MAX_XML_ELEMENTS = 20_000;

function textContent(node: Element | null) {
  return node?.textContent ?? "";
}

function localName(node: Element) {
  return node.tagName.includes(":")
    ? node.tagName.slice(node.tagName.indexOf(":") + 1)
    : node.tagName;
}

function descendantsNamed(root: ParentNode, name: string) {
  const owner =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? null);
  const scope = root instanceof Element ? root : owner?.documentElement;
  if (!scope) return [] as Element[];

  const fromNs = scope.getElementsByTagNameNS(SPREADSHEET_NS, name);
  if (fromNs.length > 0) {
    if (fromNs.length > MAX_XML_ELEMENTS) {
      throw new Error("That workbook worksheet is too large to import.");
    }
    return [...fromNs];
  }

  const all = scope.getElementsByTagName("*");
  if (all.length > MAX_XML_ELEMENTS) {
    throw new Error("That workbook worksheet is too large to import.");
  }
  const matches: Element[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const node = all[i];
    if (localName(node) === name) matches.push(node);
  }
  return matches;
}

function directChild(parent: Element, name: string) {
  for (const node of parent.children) {
    if (localName(node) === name) return node;
  }
  return null;
}

function colIndex(col: string) {
  let n = 0;
  for (const ch of col) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseCellRef(ref: string) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return { col: colIndex(match[1].toUpperCase()), row: Number(match[2]) };
}

function sharedStrings(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return descendantsNamed(doc, "si").map((si) =>
    descendantsNamed(si, "t")
      .map((t) => textContent(t))
      .join(""),
  );
}

function cellValue(cell: Element, shared: string[]) {
  const type = cell.getAttribute("t");
  const v = directChild(cell, "v");
  const is = directChild(cell, "is");

  if (type === "s" && v) {
    const index = Number(textContent(v));
    return shared[index] ?? "";
  }

  if (type === "inlineStr" && is) {
    return descendantsNamed(is, "t")
      .map((t) => textContent(t))
      .join("");
  }

  if (v) {
    const raw = textContent(v);
    if (type === "n" || type == null) {
      const num = Number(raw);
      if (!Number.isNaN(num) && raw.trim() !== "") return num;
    }
    return raw;
  }

  return "";
}

export type SheetRows = Record<number, Record<number, string | number>>;

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export async function readWorkbookSheet(
  file: ArrayBuffer,
  sheetName: string,
): Promise<SheetRows> {
  const started = performance.now();
  assertXlsxBuffer(file);
  const validateMs = Math.round(performance.now() - started);

  const zipStarted = performance.now();
  const entries = listZipEntries(file);
  const zipMs = Math.round(performance.now() - zipStarted);

  const inflateStarted = performance.now();
  const workbookXml = await readZipEntry(file, entries, "xl/workbook.xml");
  const relsXml = await readZipEntry(file, entries, "xl/_rels/workbook.xml.rels");
  if (!workbookXml) {
    throw new Error("Workbook is missing xl/workbook.xml.");
  }
  if (!relsXml) {
    throw new Error("Workbook is missing xl/_rels/workbook.xml.rels.");
  }
  const inflateCoreMs = Math.round(performance.now() - inflateStarted);

  const parseStarted = performance.now();
  const workbook = new DOMParser().parseFromString(workbookXml, "application/xml");
  const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
  const ridToTarget = new Map<string, string>();

  const relNodes = [
    ...relsDoc.getElementsByTagNameNS(REL_NS, "Relationship"),
    ...descendantsNamed(relsDoc, "Relationship"),
  ];
  for (const rel of relNodes) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) ridToTarget.set(id, target);
  }

  let sheetRid: string | null = null;
  for (const sheet of descendantsNamed(workbook, "sheet")) {
    if (sheet.getAttribute("name") === sheetName) {
      sheetRid =
        sheet.getAttributeNS(OFFICE_REL_NS, "id") ??
        sheet.getAttribute("r:id");
      break;
    }
  }

  if (!sheetRid) {
    throw new Error(`Workbook has no sheet named “${sheetName}”.`);
  }

  const target = ridToTarget.get(sheetRid);
  if (!target) {
    throw new Error(`Workbook relationship for “${sheetName}” is missing.`);
  }

  const sheetPath = normalizeZipPath(target);
  const sheetInflateStarted = performance.now();
  const sheetXml = await readZipEntry(file, entries, sheetPath);
  const sharedXml = await readZipEntry(file, entries, "xl/sharedStrings.xml");
  const inflateSheetMs = Math.round(performance.now() - sheetInflateStarted);

  if (!sheetXml) {
    throw new Error(`Could not read sheet “${sheetName}”.`);
  }

  const sheetParseStarted = performance.now();
  const shared = sharedXml ? sharedStrings(sharedXml) : [];
  const sheetDoc = new DOMParser().parseFromString(sheetXml, "application/xml");
  const rows: SheetRows = {};
  const cells = descendantsNamed(sheetDoc, "c");
  for (const cell of cells) {
    const ref = cell.getAttribute("r");
    if (!ref) continue;
    const parsed = parseCellRef(ref);
    if (!parsed) continue;
    const value = cellValue(cell, shared);
    if (value === "" || value == null) continue;
    rows[parsed.row] ??= {};
    rows[parsed.row][parsed.col] = value;
  }
  const sheetParseMs = Math.round(performance.now() - sheetParseStarted);

  logDevTiming("staff-import xlsx", {
    validateMs,
    zipMs,
    inflateCoreMs,
    inflateSheetMs,
    workbookParseMs: Math.round(performance.now() - parseStarted) - inflateSheetMs - sheetParseMs,
    sheetParseMs,
    zipEntries: entries.length,
    sheetCells: cells.length,
    sheetRows: Object.keys(rows).length,
    totalMs: Math.round(performance.now() - started),
  });

  return rows;
}

function assertXlsxBuffer(file: ArrayBuffer) {
  if (file.byteLength < 4) {
    throw new Error("That file is not a valid Excel workbook.");
  }
  const bytes = new Uint8Array(file, 0, 4);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("Please choose an .xlsx workbook.");
  }
}

function normalizeZipPath(target: string) {
  const trimmed = target.replace(/^\//, "");
  return trimmed.startsWith("xl/") ? trimmed : `xl/${trimmed}`;
}

function listZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd.entries > MAX_ZIP_ENTRIES) {
    throw new Error("That workbook is too complex to import.");
  }
  const files: ZipEntry[] = [];
  let offset = eocd.centralOffset;

  for (let i = 0; i < eocd.entries; i += 1) {
    if (offset < 0 || offset + 46 > view.byteLength) {
      throw new Error("Could not read the Excel workbook (zip directory).");
    }
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Could not read the Excel workbook (zip directory).");
    }

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    if (uncompressedSize > MAX_UNCOMPRESSED_FILE_BYTES) {
      throw new Error("That workbook is too large to import.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > view.byteLength) {
      throw new Error("Could not read the Excel workbook (zip directory).");
    }
    const name = new TextDecoder().decode(
      new Uint8Array(buffer, offset + 46, nameLength),
    );
    offset = nameEnd + extraLength + commentLength;
    files.push({
      name,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
  }

  return files;
}

async function readZipEntry(
  buffer: ArrayBuffer,
  entries: ZipEntry[],
  name: string,
) {
  const entry = entries.find((item) => item.name === name);
  if (!entry) return null;
  return inflateEntry(buffer, entry);
}

async function inflateEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  const localHeaderOffset = entry.localHeaderOffset;
  if (localHeaderOffset < 0 || localHeaderOffset + 30 > view.byteLength) {
    throw new Error(`Could not read workbook file “${entry.name}”.`);
  }
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
    throw new Error(`Could not read workbook file “${entry.name}”.`);
  }

  const localNameLength = view.getUint16(localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  if (
    dataStart < 0 ||
    entry.compressedSize < 0 ||
    dataStart + entry.compressedSize > view.byteLength
  ) {
    throw new Error(`Could not read workbook file “${entry.name}”.`);
  }
  const payload = new Uint8Array(buffer, dataStart, entry.compressedSize);
  return inflate(payload, entry.compression, entry.uncompressedSize);
}

function findEndOfCentralDirectory(view: DataView) {
  const min = Math.max(0, view.byteLength - MAX_EOCD_SCAN_BYTES);
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) !== 0x06054b50) continue;
    const entries = view.getUint16(i + 10, true);
    const centralOffset = view.getUint32(i + 16, true);
    if (centralOffset >= view.byteLength) continue;
    return { entries, centralOffset };
  }
  throw new Error("Could not read the Excel workbook.");
}

async function inflate(
  payload: Uint8Array,
  compression: number,
  uncompressedSize: number,
) {
  if (compression === 0) {
    return new TextDecoder().decode(payload);
  }
  if (compression !== 8) {
    throw new Error("Unsupported Excel compression.");
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress Excel files.");
  }

  const bytes = new Uint8Array(payload.byteLength);
  bytes.set(payload);
  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const buffer = await new Response(stream).arrayBuffer();
  if (buffer.byteLength > MAX_UNCOMPRESSED_FILE_BYTES) {
    throw new Error("That workbook is too large to import.");
  }
  const expected = uncompressedSize || buffer.byteLength;
  return new TextDecoder().decode(buffer.slice(0, expected));
}
