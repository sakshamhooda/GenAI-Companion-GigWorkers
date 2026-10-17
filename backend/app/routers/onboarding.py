from fastapi import APIRouter

from app.languages import LANGUAGES, is_supported
from app.llm import extract_json
from app.schemas import OnboardingIn, OnboardingOut
from app.voice import KEYTERMS

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

WORK_TYPES = ["delivery", "driver", "home_services", "daily_wage", "other"]

STUB = {
    "name": "Ramesh",
    "language": "hi",
    "work_types": ["delivery"],
    "platforms": ["Zomato", "Swiggy"],
    "city": "Jaipur",
    "shift": "night",
    "years_experience": 3,
    "memory": "Ramesh delivers for Zomato and Swiggy in Jaipur, mostly at night, for 3 years.",
}

SYSTEM = (
    "You extract a gig worker's profile from what they said about their work. "
    "Input may be Hindi, Hinglish (Hindi in Latin script), English or any Indian language "
    "in its own script. Be forgiving of speech-to-text errors. Return only JSON."
)


def _prompt(text: str, hint: str | None) -> str:
    langs = ", ".join(f"{c} = {i['name']}" for c, i in LANGUAGES.items())
    hint_line = f"The app language hint is '{hint}'." if hint else ""
    return f"""Worker said:
\"\"\"{text}\"\"\"
{hint_line}

Return JSON with exactly these keys:
- name: first name if they said it, else null
- language: short code of the language they spoke, one of [{langs}], else null.
  Hinglish or Hindi -> "hi". Detect from script and words.
- work_types: list from {WORK_TYPES}. delivery = food/parcel/grocery delivery;
  driver = cab/auto/bike taxi; home_services = cleaning/repair/beauty at homes;
  daily_wage = construction/labour/cash wages; other = anything else.
- platforms: list of platform names they mentioned, canonical spelling where possible
  from {KEYTERMS}; otherwise as spoken, capitalised. Empty list if none.
- city: city name in English, else null
- shift: "morning" | "day" | "evening" | "night" | "all day" | null
- years_experience: number or null
- memory: 2-3 sentences in English, third person, summarising their work and situation
  (platforms, city, hours, experience, anything they mentioned like family, vehicle, issues).
"""


@router.post("/parse", response_model=OnboardingOut)
async def parse_onboarding(body: OnboardingIn) -> OnboardingOut:
    """Public: turns a spoken/typed self-introduction into profile fields."""
    data = extract_json(_prompt(body.text, body.language_hint), SYSTEM, stub=STUB)
    language = data.get("language")
    if not is_supported(language):
        language = body.language_hint if is_supported(body.language_hint) else None
    work_types = [w for w in (data.get("work_types") or []) if w in WORK_TYPES]
    platforms = [str(p).strip() for p in (data.get("platforms") or []) if str(p).strip()]
    years = data.get("years_experience")
    try:
        years = float(years) if years is not None else None
    except (TypeError, ValueError):
        years = None
    return OnboardingOut(
        name=data.get("name") or None,
        language=language,
        work_types=work_types,
        platforms=platforms,
        city=data.get("city") or None,
        shift=data.get("shift") or None,
        years_experience=years,
        memory=(data.get("memory") or "").strip(),
    )
