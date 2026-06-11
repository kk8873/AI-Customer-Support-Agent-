"""ElevenLabs adapter for text-to-speech, streamed as MP3 chunks."""

from collections.abc import AsyncIterator

import httpx

_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"


class ElevenLabsTTS:
    def __init__(self, api_key: str, voice_id: str, model: str) -> None:
        self._api_key = api_key
        self._voice_id = voice_id
        self._model = model

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        url = _TTS_URL.format(voice_id=self._voice_id)
        payload = {
            "text": text,
            "model_id": self._model,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                url,
                headers={"xi-api-key": self._api_key, "Content-Type": "application/json"},
                json=payload,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    if chunk:
                        yield chunk
