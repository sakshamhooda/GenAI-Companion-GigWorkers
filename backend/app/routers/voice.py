from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status

from app import ratelimit
from app.auth import get_current_user
from app.languages import is_supported
from app.models import User
from app.schemas import SpeakIn, TranscriptOut
from app.voice import synthesize, transcribe

router = APIRouter(prefix="/voice", tags=["voice"])

MAX_BYTES = 3 * 1024 * 1024


@router.post(
    "/transcribe",
    response_model=TranscriptOut,
    dependencies=[Depends(ratelimit.per_ip("voice-transcribe", 20))],
)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(default=None, max_length=5),
) -> TranscriptOut:
    """Public: onboarding records a voice note before the worker has an account."""
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("audio/"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload an audio file")
    audio = await file.read()
    if len(audio) > MAX_BYTES:
        raise HTTPException(413, "Audio larger than 3 MB")
    if not audio:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio")
    result = await transcribe(audio, file.filename or "audio", content_type, language or None)
    return TranscriptOut(**result)


@router.post(
    "/speak",
    dependencies=[Depends(ratelimit.per_user("voice-speak", 30))],
    responses={200: {"content": {"audio/mpeg": {}, "audio/wav": {}}}},
)
async def speak(body: SpeakIn, user: User = Depends(get_current_user)) -> Response:
    """Read `text` aloud in the worker's language. Returns MP3 (Sarvam) or WAV (Gemini)."""
    language = body.language or user.language
    if not is_supported(language):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unsupported language")
    try:
        audio, mime, provider = await synthesize(body.text, language)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Nothing to say") from None
    return Response(
        content=audio,
        media_type=mime,
        headers={"Cache-Control": "private, max-age=3600", "X-TTS-Provider": provider},
    )
