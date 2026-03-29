"""Enhancement 7: Redis-backed chat session persistence.

Sessions are keyed by `epilink:chat:{session_id}` with a configurable TTL
(default 2 hours). Each session stores a JSON array of {role, content} dicts.

When a session accumulates >= `summarize_after_turns * 2` messages, the
oldest messages are compressed into a Gemini-generated summary so the
context window never overflows during long conversations.
"""

from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

_REDIS_KEY_PREFIX = "epilink:chat:"
_SUMMARY_PLACEHOLDER = "(Previous conversation has been summarised to save context)"


class SessionService:
    """Redis-backed chat session store.

    Falls back silently to a no-op (stateless) mode when Redis is
    unavailable, so the rest of the service keeps working.
    """

    def __init__(
        self,
        redis_url: str | None,
        ttl_seconds: int = 7200,
        summarize_after_turns: int = 10,
    ) -> None:
        self._redis = None
        self._ttl = ttl_seconds
        self._summarize_threshold = summarize_after_turns * 2  # turns → messages
        self._ready = False

        if redis_url:
            try:
                import redis as _redis_lib  # noqa: PLC0415
                client = _redis_lib.from_url(redis_url, decode_responses=True)
                client.ping()
                self._redis = client
                self._ready = True
                print(f"[SessionService] Connected to Redis (TTL={ttl_seconds}s, "
                      f"summarize_after={summarize_after_turns} turns)")
            except Exception as exc:
                print(f"[SessionService] Redis unavailable: {exc} — running stateless.")

    # ── Public API ────────────────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        return self._ready

    def create_session(self) -> str:
        """Allocate a new session ID and initialise its empty history."""
        session_id = str(uuid.uuid4())
        if self._redis:
            self._redis.setex(self._key(session_id), self._ttl, json.dumps([]))
        return session_id

    def get_messages(self, session_id: str) -> list[dict]:
        """Return stored messages or an empty list if the session is unknown."""
        if not self._redis:
            return []
        raw = self._redis.get(self._key(session_id))
        return json.loads(raw) if raw else []

    def append_messages(self, session_id: str, new_messages: list[dict]) -> None:
        """Append messages and refresh the TTL."""
        if not self._redis:
            return
        history = self.get_messages(session_id)
        history.extend(new_messages)
        self._redis.setex(self._key(session_id), self._ttl, json.dumps(history))

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True when it existed."""
        if not self._redis:
            return False
        return bool(self._redis.delete(self._key(session_id)))

    def session_exists(self, session_id: str) -> bool:
        """Return True when the session key is present in Redis."""
        if not self._redis:
            return False
        return bool(self._redis.exists(self._key(session_id)))

    def needs_summarization(self, session_id: str) -> bool:
        """True when the stored history is long enough to warrant compression."""
        return len(self.get_messages(session_id)) >= self._summarize_threshold

    def summarize_and_compress(
        self,
        session_id: str,
        gemini_client,  # google.genai.Client
        model: str,
    ) -> None:
        """Compress the oldest messages into a Gemini-generated summary.

        Keeps the 4 most-recent messages verbatim so continuity is preserved,
        and replaces the older history with a 3–5 bullet summary.
        """
        messages = self.get_messages(session_id)
        if len(messages) < self._summarize_threshold:
            return

        to_summarize = messages[:-4]
        keep_recent = messages[-4:]

        conversation_text = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in to_summarize
        )

        summary_prompt = (
            "Summarise the following dengue analytics conversation in 3–5 concise bullet points. "
            "Preserve all specific district names, statistics, tool results, and recommendations.\n\n"
            f"{conversation_text}"
        )

        try:
            resp = gemini_client.models.generate_content(
                model=model,
                contents=[{"role": "user", "parts": [{"text": summary_prompt}]}],
                config={"temperature": 0.1},
            )
            summary_text = (resp.text or "").strip() or _SUMMARY_PLACEHOLDER
        except Exception as exc:
            print(f"[SessionService] Summarisation failed: {exc}")
            summary_text = (
                f"(Previous {len(to_summarize)} messages summarised — "
                "summary unavailable due to API error)"
            )

        compressed = [
            {"role": "user", "content": "[Conversation context — see summary below]"},
            {"role": "assistant", "content": summary_text},
        ] + keep_recent

        if self._redis:
            self._redis.setex(
                self._key(session_id), self._ttl, json.dumps(compressed)
            )

    # ── Helpers ───────────────────────────────────────────────────────

    def _key(self, session_id: str) -> str:
        return f"{_REDIS_KEY_PREFIX}{session_id}"
