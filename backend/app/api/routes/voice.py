"""Voice I/O endpoints. The agent itself is unchanged — these only convert
speech to text (in) and text to speech (out) around the existing /chat agent."""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.voice import get_stt_client, get_tts_client

router = APIRouter(prefix="/voice", tags=["voice"])


class SpeakRequest(BaseModel):
    text: str


@router.post("/transcribe")
async def transcribe(request: Request) -> dict[str, str]:
    # Audio arrives as the raw request body (e.g. audio/webm from the browser).
    audio = await request.body()
    content_type = request.headers.get("content-type") or "audio/webm"
    stt = get_stt_client(get_settings())
    return {"text": await stt.transcribe(audio, content_type=content_type)}


@router.post("/speak")
async def speak(payload: SpeakRequest) -> StreamingResponse:
    tts = get_tts_client(get_settings())
    return StreamingResponse(tts.synthesize(payload.text), media_type="audio/mpeg")
