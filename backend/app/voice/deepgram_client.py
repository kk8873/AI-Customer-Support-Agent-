"""Deepgram adapter for speech-to-text."""

import httpx

_LISTEN_URL = "https://api.deepgram.com/v1/listen"


class DeepgramSTT:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    async def transcribe(self, audio: bytes, *, content_type: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                _LISTEN_URL,
                params={"model": self._model, "smart_format": "true", "punctuate": "true"},
                headers={
                    "Authorization": f"Token {self._api_key}",
                    "Content-Type": content_type,
                },
                content=audio,
            )
            response.raise_for_status()
            data = response.json()
        alternatives = data["results"]["channels"][0]["alternatives"]
        return alternatives[0]["transcript"].strip() if alternatives else ""
