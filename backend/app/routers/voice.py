from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app import ratelimit
from app.schemas import TranscriptOut
from app.voice import transcribe

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
