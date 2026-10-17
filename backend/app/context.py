from collections.abc import Sequence

from app.models import Earning, User

SYSTEM_PROMPT = """You are Saathi, a friendly companion for gig and informal workers in India
(delivery partners, drivers, daily-wage workers, home-service workers).

Rules:
- Always reply in the worker's language given by the language code in the context
  (hi = Hindi in Devanagari, en = English, otherwise that language). Keep it natural.
- Use simple words and short sentences. Assume the reader is busy and on a phone.
- Be practical: give concrete steps, numbers and names of schemes when relevant.
- Never invent legal facts, scheme amounts or deadlines. If unsure, say so and point to
  the official helpline or office.
- For safety questions always mention emergency numbers: 112 (emergency), 1091 (women
  helpline), and the platform's in-app SOS.
- You know the worker's profile, memory notes and recent earnings from the context.
  Use them. Do not ask for information already in the context.
- Plain text only. No markdown, no asterisks, no headings. Use numbered lines for steps.
"""

LANGUAGE_NAMES = {
    "hi": "Hindi",
    "en": "English",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
}


def build_context(user: User, earnings: Sequence[Earning]) -> str:
    lang = LANGUAGE_NAMES.get(user.language, user.language)
    lines = [
        "WORKER PROFILE",
        f"- name: {user.name or 'unknown'}",
        f"- work type: {user.work_type or 'unknown'}",
        f"- platform: {user.platform or 'unknown'}",
        f"- city: {user.city or 'unknown'}",
        f"- language: {user.language} ({lang})",
    ]
    if user.memory:
        lines += ["", "MEMORY NOTES", user.memory.strip()]
    lines += ["", "EARNINGS (last 7 days)"]
    if earnings:
        total = sum(e.amount for e in earnings)
        exp = sum(e.expenses for e in earnings)
        for e in earnings:
            note = f" ({e.note})" if e.note else ""
            lines.append(
                f"- {e.date.isoformat()}: earned ₹{e.amount:.0f}, expenses ₹{e.expenses:.0f},"
                f" {e.platform or user.platform}{note}"
            )
        lines.append(f"- total earned ₹{total:.0f}, expenses ₹{exp:.0f}, net ₹{total - exp:.0f}")
    else:
        lines.append("- no entries yet")
    return "\n".join(lines)
