"""Voice client interfaces (ports) for speech-to-text and text-to-speech.

The API layer depends only on these Protocols, never on a vendor SDK — exactly
like the LLMClient seam. Concrete adapters (Deepgram for STT, ElevenLabs for TTS)
implement them, so a provider swap is a config change, not a code change.
"""

from collections.abc import AsyncIterator
from typing import Protocol


class STTClient(Protocol):
    async def transcribe(self, audio: bytes, *, content_type: str) -> str: ...


class TTSClient(Protocol):
    def synthesize(self, text: str) -> AsyncIterator[bytes]: ...
