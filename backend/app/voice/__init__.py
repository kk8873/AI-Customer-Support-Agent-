"""Voice provider selection — STT and TTS clients chosen from config."""

from app.config import Settings
from app.voice.client import STTClient, TTSClient
from app.voice.deepgram_client import DeepgramSTT
from app.voice.elevenlabs_client import ElevenLabsTTS


def get_stt_client(settings: Settings) -> STTClient:
    if settings.stt_provider == "deepgram":
        if not settings.deepgram_api_key:
            raise RuntimeError("DEEPGRAM_API_KEY is not set — required for Deepgram STT.")
        return DeepgramSTT(settings.deepgram_api_key, settings.deepgram_model)
    raise ValueError(f"Unknown STT provider: {settings.stt_provider}")


def get_tts_client(settings: Settings) -> TTSClient:
    if settings.tts_provider == "elevenlabs":
        if not (settings.elevenlabs_api_key and settings.elevenlabs_voice_id):
            raise RuntimeError(
                "ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set — required for ElevenLabs TTS."
            )
        return ElevenLabsTTS(
            settings.elevenlabs_api_key, settings.elevenlabs_voice_id, settings.elevenlabs_model
        )
    raise ValueError(f"Unknown TTS provider: {settings.tts_provider}")
