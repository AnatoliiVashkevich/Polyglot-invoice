"""ai.py - the AI parts (product-decisions.md §6, §9; build step 7). The only file that talks to OpenAI.

Part 1 (now): "Describe the work and prices" -> clean invoice lines, in the user's own words and language.
Later parts: voice (transcribe, then fill the questionnaire) and translated PDFs.
The app asks for consent before anything is sent here (App Store rule, §2). OpenAI's API doesn't train on this data.
"""
import logging
import os
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, Field

log = logging.getLogger("polyglot")

TEXT_MODEL = os.getenv("AI_TEXT_MODEL", "gpt-5.4-mini")   # fast and cheap; checked available 2026-11-19

REPAIR_WORDS = """For repair and construction work: "пол" is a floor (never gender), "плитка" tile, "гипсокартон" drywall,
"шпаклёвка" spackle / joint compound, "плинтус" baseboard, "откосы" window/door returns, "затирка" grout, "наличник"
door casing, "piso" floor, "azulejo" tile, "rodapé"/"zócalo" baseboard."""


def context(trade: str = "") -> str:
    """Who the AI works for (§6m): the user's own trade from Settings ("What kind of work do you do?"), so every word
    is read in that work's sense (a hairdresser's "окрашивание" is hair coloring). No trade yet: a neutral small
    service business. The repair glossary helps whenever repair words appear."""
    trade = (trade or "").strip()[:300]
    who = (f"a solo self-employed professional in the USA whose work is: {trade}" if trade
           else "a solo self-employed professional in the USA running a small service business (any trade)")
    return f"""You work for {who}.
Read every word in the sense of this person's work and the services and materials they sell, never in an unrelated
everyday sense. If a word fits several trades, choose the one closest to this work.
{REPAIR_WORDS}"""


LINES_RULES = """You turn the professional's description of their work into invoice lines.
Rules:
- One line per distinct piece of work or material. Keep the user's language and wording; just tidy it
  (capital first letter, no price inside the text).
- qty is how many (pieces, hours, square feet...); price is the price of ONE.
- When the count goes into qty, take it out of the text (digits or words like "two", "две", "dos") and keep the rest
  natural in the same language: "две двустворчатые двери, установка 700" -> text "Двустворчатая дверь, установка", qty 2.
- If a count and one amount are given without "each"/"per"/"по"/"cada", the amount is the line total: price = total / qty.
  "2 doors 700" -> qty 2, price 350. "2 doors 200 each" -> qty 2, price 200. "3 hours at 60" -> qty 3, price 60.
- A fixed price for a whole scope of work -> one line, qty 1.
- kind = "material" for things bought for the client (tile, hinges, paint, hair dye, parts), otherwise "work".
- Never invent prices. A line without an amount gets price 0.
- Amounts are US dollars; "1.5k" = 1500.
- Write each line as short, professional invoice wording in the SAME language (a noun phrase, fixed spelling), without
  changing the meaning: "съездил в магазин" -> "Поездка в магазин за материалами", "fixed the door thing" -> "Door repair".
- When you are NOT sure what a part means (a typo you can't fix with confidence, an unknown word, a rude or odd word,
  two possible meanings): keep the user's words in text, and fill `question` — a short, polite question to the user
  in THEIR language ("Что вы имели в виду под «пердел»?") — and `suggestion` — your best guess as the tidy line text in
  their language ("Переделка работы"), or "" if you have no good guess. Otherwise question and suggestion are "".
  Never guess silently: a wrong word on an invoice embarrasses the user in front of their client.
"""

TRANSLATE_RULES = """You translate the lines of the professional's invoice into {language} for their client.
Rules:
- Return exactly one translation per input line, in the same order.
- Professional, short invoice wording in {language}, using the terms someone in this trade there would use.
- Keep numbers, sizes, units, brand and product names as they are. Never add or drop information.
- A line already in {language}: return it as it is (only fix obvious spelling).
- Never replace a word you don't understand with an unrelated one; translate the closest clear meaning.
"""

LANGUAGE_NAMES = {"en": "English (US)", "es": "Spanish (as spoken in the USA)", "pt": "Portuguese (Brazilian)",
                  "ru": "Russian", "uk": "Ukrainian"}


class AiLine(BaseModel):
    text: str = Field(max_length=500)
    qty: float
    price: float
    kind: Literal["work", "material"]
    question: str   # "" when clear; else a question to the user in their language (§6n)
    suggestion: str  # the AI's best guess for the text when it asks, or ""


class AiLines(BaseModel):
    lines: list[AiLine]


class AiTexts(BaseModel):
    texts: list[str]


class AiUnavailable(Exception):
    """No key, no network, or the AI answered nonsense: the app keeps the user's text and lets them type lines."""


def _client():
    if not os.getenv("OPENAI_API_KEY"):
        raise AiUnavailable("No AI key on the server.")
    from openai import OpenAI   # imported here so the tests and the rest of the server never need it
    return OpenAI(timeout=30)


def text_to_lines(text: str, trade: str = "") -> list[dict]:
    """The user's words -> [{text, qty, price, kind}], cleaned and within the invoice limits."""
    try:
        res = _client().responses.parse(model=TEXT_MODEL, instructions=context(trade) + "\n\n" + LINES_RULES,
                                        input=text[:4000], text_format=AiLines)
        parsed = res.output_parsed
    except AiUnavailable:
        raise
    except Exception as e:   # network, quota, refusal…
        log.warning("AI lines failed: %s", e)
        raise AiUnavailable("The AI is not available right now.") from e
    if not parsed:
        raise AiUnavailable("The AI could not read it.")
    return clean_lines([line.model_dump() for line in parsed.lines])


def clean_lines(lines: list[dict]) -> list[dict]:
    """Keeps the AI's lines inside the same limits as typed lines (server Line model), drops empty ones."""
    out = []
    for line in lines:
        text = (line.get("text") or "").strip()[:500]
        qty = min(max(float(line.get("qty") or 1), 0), 100000) or 1
        cents = Decimal(str(line.get("price") or 0)).quantize(Decimal("0.01"), ROUND_HALF_UP)   # like money.py
        price = min(max(float(cents), -1000000), 1000000)
        if text or price:
            row = {"text": text, "qty": qty, "price": price, "kind": "material" if line.get("kind") == "material" else "work"}
            question = (line.get("question") or "").strip()[:300]
            if question:   # the AI isn't sure: the app asks the user under this line
                row["question"] = question
                row["suggestion"] = (line.get("suggestion") or "").strip()[:500]
            out.append(row)
    return out[:200]


def translate_texts(texts: list[str], lang: str, trade: str = "") -> list[str]:
    """Invoice line texts -> the same lines in `lang`, in the sense of the user's trade. Same count, same order."""
    if not texts:
        return []
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    try:
        res = _client().responses.parse(model=TEXT_MODEL, input=numbered[:12000], text_format=AiTexts,
                                        instructions=context(trade) + "\n\n" + TRANSLATE_RULES.format(language=LANGUAGE_NAMES.get(lang, lang)))
        out = res.output_parsed.texts if res.output_parsed else []
    except AiUnavailable:
        raise
    except Exception as e:
        log.warning("AI translation failed: %s", e)
        raise AiUnavailable("The AI is not available right now.") from e
    out = [o.strip().removeprefix(f"{i + 1}.").strip() for i, o in enumerate(out)]
    if len(out) != len(texts) or not all(out):
        raise AiUnavailable("The AI translation came back incomplete.")
    return [o[:500] for o in out]
