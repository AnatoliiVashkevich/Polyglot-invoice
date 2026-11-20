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

CONTEXT = """You work for a solo home-repair / construction / handyman contractor in the USA (doors, floors, tile,
drywall, paint, decks, plumbing and electrical fixes, furniture assembly, cleaning). Always read words in that trade
sense: "пол" is a floor (never gender), "плитка" is tile, "гипсокартон" drywall, "шпаклёвка" spackle / joint compound,
"плинтус" baseboard, "откосы" window/door returns, "затирка" grout, "наличник" door casing, "piso" floor, "azulejo" tile,
"rodapé"/"zócalo" baseboard."""

LINES_RULES = CONTEXT + """

You turn the contractor's description of work into invoice lines.
Rules:
- One line per distinct piece of work or material. Keep the user's language and wording; just tidy it
  (capital first letter, no price inside the text).
- qty is how many (pieces, hours, square feet...); price is the price of ONE.
- When the count goes into qty, take it out of the text (digits or words like "two", "две", "dos") and keep the rest
  natural in the same language: "две двустворчатые двери, установка 700" -> text "Двустворчатая дверь, установка", qty 2.
- If a count and one amount are given without "each"/"per"/"по"/"cada", the amount is the line total: price = total / qty.
  "2 doors 700" -> qty 2, price 350. "2 doors 200 each" -> qty 2, price 200. "3 hours at 60" -> qty 3, price 60.
- A fixed price for a whole scope of work -> one line, qty 1.
- kind = "material" for things bought (tile, hinges, paint, lumber), otherwise "work".
- Never invent prices. A line without an amount gets price 0.
- Amounts are US dollars; "1.5k" = 1500.
- Write each line as short, professional invoice wording in the SAME language (a noun phrase, fixed spelling), without
  changing the meaning: "съездил в магазин" -> "Поездка в магазин за материалами", "fixed the door thing" -> "Door repair".
"""

TRANSLATE_RULES = CONTEXT + """

You translate the lines of the contractor's invoice into {language} for their client.
Rules:
- Return exactly one translation per input line, in the same order.
- Professional, short invoice wording in {language}, using the trade terms a contractor there would use.
- Keep numbers, sizes, units, brand and product names as they are. Never add or drop information.
- A line already in {language}: return it as it is (only fix obvious spelling).
"""

LANGUAGE_NAMES = {"en": "English (US)", "es": "Spanish (as spoken in the USA)", "pt": "Portuguese (Brazilian)",
                  "ru": "Russian", "uk": "Ukrainian"}


class AiLine(BaseModel):
    text: str = Field(max_length=500)
    qty: float
    price: float
    kind: Literal["work", "material"]


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


def text_to_lines(text: str) -> list[dict]:
    """The user's words -> [{text, qty, price, kind}], cleaned and within the invoice limits."""
    try:
        res = _client().responses.parse(model=TEXT_MODEL, instructions=LINES_RULES, input=text[:4000], text_format=AiLines)
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
            out.append({"text": text, "qty": qty, "price": price, "kind": "material" if line.get("kind") == "material" else "work"})
    return out[:200]


def translate_texts(texts: list[str], lang: str) -> list[str]:
    """Invoice line texts -> the same lines in `lang`, in the trade sense (see CONTEXT). Same count, same order."""
    if not texts:
        return []
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    try:
        res = _client().responses.parse(model=TEXT_MODEL, input=numbered[:12000], text_format=AiTexts,
                                        instructions=TRANSLATE_RULES.format(language=LANGUAGE_NAMES.get(lang, lang)))
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
