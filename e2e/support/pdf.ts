import { createRequire } from "node:module";
import path from "node:path";
import { expect, type Download, type Page } from "@playwright/test";

// Generated PDFs: the dashboard asks the API for a file URL, fetches /files/<name> with the session's
// token and opens the bytes as a blob: popup, falling back to a document.pdf download.

export type CapturedPdf = {
  /** How the dashboard handed the file over. */
  openedAs: "popup" | "download";
  /** The /files/... address the dashboard read the file from. */
  url: string;
  contentType: string;
  bytes: Buffer;
  pages: number;
  /** The text of every page, one line per page, runs joined by single spaces. */
  text: string;
};

const resolveModule = createRequire(import.meta.url).resolve;

/** Reads the page count and text of a PDF with pdfjs-dist. */
export async function readPdf(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js wants a folder "URL" ending in a forward slash, also for a local path.
  const fonts = `${path.join(path.dirname(resolveModule("pdfjs-dist/package.json")), "standard_fonts").replaceAll("\\", "/")}/`;
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: fonts, verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const runs = content.items.map((item) => ("str" in item ? item.str : "")).filter((s) => s.trim() !== "");
      pages.push(runs.join(" ").replace(/\s+/g, " "));
    }
    return { pages: doc.numPages, text: pages.join("\n") };
  } finally {
    await task.destroy();
  }
}

/** Runs `action` (a click on a PDF button) and returns the PDF the dashboard opened. */
export async function capturePdf(page: Page, action: () => Promise<void>): Promise<CapturedPdf> {
  const file = page.waitForResponse(
    (r) => r.request().method() === "GET" && new URL(r.url()).pathname.startsWith("/files/"),
    { timeout: 30_000 },
  );
  let settle: (value: { popup?: Page; download?: Download }) => void = () => {};
  const opened = new Promise<{ popup?: Page; download?: Download }>((resolve) => (settle = resolve));
  const onPopup = (popup: Page) => settle({ popup });
  const onDownload = (download: Download) => settle({ download });
  page.on("popup", onPopup);
  page.on("download", onDownload);
  try {
    await action();
    const response = await file;
    expect(response.status(), `GET ${new URL(response.url()).pathname}`).toBe(200);
    const how = await Promise.race([
      opened,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no popup or download after the PDF was fetched")), 15_000)),
    ]);
    if (how.popup) {
      await how.popup.waitForURL(/^blob:/);
      await how.popup.close();
    }
    if (how.download) await how.download.delete();
    // Chromium doesn't keep the body of this fetch for us, so read the same file again with the tab's session.
    const token = await page.evaluate(() => sessionStorage.getItem("token"));
    const again = await fetch(response.url(), { headers: { Authorization: `Bearer ${token}` } });
    expect(again.status, `GET ${new URL(response.url()).pathname}`).toBe(200);
    const bytes = Buffer.from(await again.arrayBuffer());
    const { pages, text } = await readPdf(bytes);
    return {
      openedAs: how.popup ? "popup" : "download",
      url: response.url(),
      contentType: response.headers()["content-type"] ?? "",
      bytes,
      pages,
      text,
    };
  } finally {
    page.off("popup", onPopup);
    page.off("download", onDownload);
  }
}

/** A real PDF with at least one page that contains every one of `texts`. */
export function expectPdf(pdf: CapturedPdf, texts: (string | RegExp)[]): void {
  expect(pdf.contentType).toContain("application/pdf");
  expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.pages).toBeGreaterThanOrEqual(1);
  for (const text of texts) {
    if (typeof text === "string") expect(pdf.text).toContain(text);
    else expect(pdf.text).toMatch(text);
  }
}
