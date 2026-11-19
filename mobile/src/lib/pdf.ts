// The invoice PDF: downloaded from the server into the phone's cache, shown on the invoice screen, and sent
// through the iPhone share sheet (Mail, Messages, WhatsApp…). Sending switches the invoice to Requested.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { accessToken, api, API_URL } from '@/lib/api';
import type { ServerItem } from '@/lib/items';

/** INV-0012-EN.pdf (the same name the server gives). */
export function pdfName(item: Pick<ServerItem, 'number'>, lang: string) {
  const number = (item.number || 'invoice').replace(/[^A-Za-z0-9_-]/g, '-');
  return `${number}-${lang.toUpperCase()}.pdf`;
}

/** Download a fresh copy of the PDF and return the local file. */
export async function downloadPdf(item: ServerItem, lang: string): Promise<File> {
  await api(`/api/items/${item.id}`); // refreshes an expired sign-in before the download
  const dir = new Directory(Paths.cache, 'pdf');
  if (!dir.exists) dir.create({ intermediates: true });
  // a new folder per download, so the WebView never shows an old cached copy
  const folder = new Directory(dir, String(Date.now()));
  folder.create();
  const file = new File(folder, pdfName(item, lang));
  return File.downloadFileAsync(`${API_URL}/api/items/${item.id}/pdf?lang=${lang}`, file, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    idempotent: true,
  });
}

/** Opens the share sheet. Resolves when it closes. Returns false if sharing isn't possible. */
export async function sharePdf(file: File): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  return true;
}

/** Remove downloaded PDFs older than a day (they are only copies). */
export function cleanOldPdfs() {
  try {
    const dir = new Directory(Paths.cache, 'pdf');
    if (!dir.exists) return;
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    for (const entry of dir.list()) {
      if (entry instanceof Directory && Number(entry.name) < dayAgo) entry.delete();
    }
  } catch {}
}
