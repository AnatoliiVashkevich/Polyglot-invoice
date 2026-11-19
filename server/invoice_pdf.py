"""invoice_pdf.py - draws an invoice / estimate PDF (US Letter) with ReportLab. Adapted from crm-solo.

Layout, top to bottom:
    [logo] the business (name, address, phone, email)      INVOICE, No., Date, Due · "PAID" once paid
    BILL TO (client: name, address, phone, email)          JOB SITE (only when it differs from the client's address)
    Description | Qty | Rate | Amount                      <- the item's lines
    Subtotal · Sales tax (only when there is tax) · TOTAL DUE / TOTAL PAID
    Payment details, terms, thank-you line

Every printed label is in the document language (doc_i18n.py). Cyrillic needs a TrueType font: PDF_FONT /
PDF_FONT_BOLD in .env, else the first one found among the usual Windows / Linux / macOS fonts, else Helvetica.
Gets plain dicts, returns PDF bytes. Never touches the database.
"""
import logging
import os
import urllib.request
from datetime import date
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from doc_i18n import labels as doc_labels
from doc_i18n import lang_code
from money import cents, line_amount

log = logging.getLogger("polyglot")

GRAY = colors.HexColor("#6b7280")
LINE = colors.HexColor("#d1d5db")
DARK = colors.HexColor("#111827")
GREEN = "#16a34a"

FONT_CANDIDATES = [   # (regular, bold): the first pair that exists is used
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
     "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]
_fonts = None


def fonts() -> tuple[str, str]:
    """(regular, bold) font names for ReportLab, registered once."""
    global _fonts
    if _fonts:
        return _fonts
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pairs = [(os.getenv("PDF_FONT"), os.getenv("PDF_FONT_BOLD") or os.getenv("PDF_FONT"))] if os.getenv("PDF_FONT") else []
    for regular, bold in pairs + FONT_CANDIDATES:
        if regular and bold and os.path.exists(regular) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont("DocSans", regular))
                pdfmetrics.registerFont(TTFont("DocSans-Bold", bold))
                _fonts = ("DocSans", "DocSans-Bold")
                return _fonts
            except Exception:
                log.warning("PDF font %s could not be loaded", regular, exc_info=True)
    log.warning("No TrueType font found: PDFs use Helvetica (no Cyrillic). Set PDF_FONT in .env.")
    _fonts = ("Helvetica", "Helvetica-Bold")
    return _fonts


def usd(x) -> str:
    return f"${cents(x):,.2f}"


def qty_text(x) -> str:
    """2.0 -> '2', 2.25 -> '2.25'."""
    return f"{float(x if x not in (None, '') else 1):g}"


def date_text(iso, lang: str) -> str:
    """US style for English (11/19/2026), day first for the others (19/11/2026, 19.11.2026)."""
    if not iso:
        return ""
    d = date.fromisoformat(str(iso)[:10])
    if lang == "en":
        return d.strftime("%m/%d/%Y")
    return d.strftime("%d.%m.%Y" if lang in ("ru", "uk") else "%d/%m/%Y")


def load_logo(url: str, max_w=1.6 * inch, max_h=0.8 * inch):
    """The business logo (a public image link) scaled to fit. None if missing or unreachable:
    a broken logo link must never stop the PDF."""
    if not url or not url.startswith(("http://", "https://")):
        return None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "PolyglotInvoice/1.0"}),
                                    timeout=5) as r:
            data = BytesIO(r.read(2 * 1024 * 1024))
        w, h = ImageReader(data).getSize()
        scale = min(max_w / w, max_h / h, 1)
        data.seek(0)
        img = Image(data, width=w * scale, height=h * scale)
        img.hAlign = "LEFT"
        return img
    except Exception:
        log.warning("Logo could not be loaded for the PDF", exc_info=True)
        return None


def file_name(item: dict, lang: str) -> str:
    """INV-0012-EN.pdf (product-decisions.md §9). Characters a file name can't hold are replaced."""
    number = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (item.get("number") or "invoice"))
    return f"{number}-{lang_code(lang).upper()}.pdf"


def build_pdf(item: dict, client: dict, business: dict, lang: str = "en") -> bytes:
    L = doc_labels(lang)
    lang = lang_code(lang)
    regular, heavy = fonts()
    is_estimate = item.get("kind") == "estimate"
    word = L["ESTIMATE"] if is_estimate else L["INVOICE"]
    paid = item.get("status") == "paid" and not is_estimate

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.8 * inch, rightMargin=0.8 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.7 * inch,
                            title=f"{word.title()} {item.get('number') or ''}".strip(),
                            author=business.get("name") or "")
    base = getSampleStyleSheet()["Normal"]
    body = ParagraphStyle("body", parent=base, fontName=regular, fontSize=10, leading=13, textColor=DARK)
    small = ParagraphStyle("small", parent=body, fontSize=9, leading=12, textColor=GRAY)
    bold = ParagraphStyle("bold", parent=body, fontName=heavy)
    title = ParagraphStyle("title", parent=body, fontName=heavy, fontSize=24, leading=28, alignment=2)
    right = ParagraphStyle("right", parent=body, alignment=2)
    right_bold = ParagraphStyle("right_bold", parent=bold, alignment=2)

    def P(text, style=body):
        """Plain text -> paragraph (user text is escaped so '<' or '&' can't break the PDF)."""
        return Paragraph(escape(str(text or "")).replace("\n", "<br/>"), style)

    def present(*values):
        return [x for x in values if x]

    # ---- header: [logo] the business (left) | INVOICE + number / date / due / PAID (right)
    logo = load_logo(business.get("logo_url"))
    left = ([logo, Spacer(1, 6)] if logo else [])
    left += [P(business.get("name") or L["Your Company"], ParagraphStyle("co", parent=bold, fontSize=14, leading=18))]
    left += [P(x, small) for x in present(business.get("address"), business.get("phone"), business.get("email"))]
    rt = [Paragraph(escape(word), title),
          P(f"{L['No.']} {item.get('number') or '-'}", right_bold),
          P(f"{L['Date']}: {date_text(item.get('date'), lang)}", right)]
    if not is_estimate and not paid:
        due = item.get("due_date")
        rt.append(P(L["Due now"] if not due or due == item.get("date") else f"{L['Due']}: {date_text(due, lang)}", right))
    if paid:
        when = " ".join(present(L["on"], date_text(item.get("paid_date"), lang)))
        rt.append(Paragraph(f'<font color="{GREEN}"><b>{escape(f"{L["PAID"]} {when}".strip())}</b></font>', right))
    head = Table([[left, rt]], colWidths=[3.4 * inch, 3.5 * inch])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    # ---- bill to (the client's name, address, phone and email together) | job site only when it is elsewhere
    bill = [P(L["BILL TO"], small), P(client.get("name") or "-", ParagraphStyle("cl", parent=bold, fontSize=12, leading=16))]
    bill += [P(x) for x in present(client.get("address"), client.get("phone"), client.get("email"))]
    site_address = (item.get("address") or "").strip()
    elsewhere = site_address and site_address.lower() != (client.get("address") or "").strip().lower()
    site = [P(L["JOB SITE"], small), P(site_address)] if elsewhere else []
    parties = Table([[bill, site]], colWidths=[3.4 * inch, 3.5 * inch])
    parties.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))

    # ---- lines
    rows = [[P(L["Description"], bold), P(L["Qty"], right_bold), P(L["Rate"], right_bold), P(L["Amount"], right_bold)]]
    for line in item.get("lines") or []:
        rows.append([P(line.get("text") or "-"), P(qty_text(line.get("qty")), right),
                     P(usd(line.get("price")), right), P(usd(line_amount(line)), right)])
    if len(rows) == 1:
        rows.append([P("-"), P(""), P(""), P(usd(0), right)])
    table = Table(rows, colWidths=[3.9 * inch, 0.8 * inch, 1.0 * inch, 1.2 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 1, DARK), ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    # ---- totals: Subtotal · Sales tax (only when there is tax) · TOTAL
    total_label = L["ESTIMATED TOTAL"] if is_estimate else (L["TOTAL PAID"] if paid else L["TOTAL DUE"])
    sums = []
    if cents(item.get("tax")) > 0:
        rate = f"{float(item.get('tax_rate') or 0):g}%"
        sums += [[P(L["SUBTOTAL"], right), P(usd(item.get("subtotal")), right)],
                 [P(f"{L['SALES TAX']} {rate}", right), P(usd(item.get("tax")), right)]]
    sums.append([P(total_label, right_bold),
                 P(usd(item.get("total")), ParagraphStyle("t", parent=right_bold, fontSize=14, leading=18))])
    totals = Table(sums, colWidths=[5.7 * inch, 1.2 * inch])
    totals.setStyle(TableStyle([("LINEABOVE", (0, len(sums) - 1), (-1, len(sums) - 1), 1, DARK),
                                ("TOPPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]))

    story = [head, Spacer(1, 22), parties, Spacer(1, 22), table, Spacer(1, 6), totals, Spacer(1, 20)]
    if business.get("payment_info") and not paid:
        story += [P(L["PAYMENT DETAILS"], small), P(business["payment_info"]), Spacer(1, 10)]
    if item.get("terms"):
        story += [P(L["TERMS"], small), P(item["terms"]), Spacer(1, 10)]
    story.append(P(L["not a bill"] if is_estimate else L["thanks"], small))
    doc.build(story)
    return buf.getvalue()
