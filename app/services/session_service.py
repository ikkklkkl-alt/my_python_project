import time
import uuid
from typing import Any


def _now() -> float:
    return time.time()


class SessionService:
    """In-memory sessions (resets on server restart)."""

    def __init__(self) -> None:
        self._data: dict[str, dict[str, Any]] = {}

    def create_session(self) -> str:
        sid = str(uuid.uuid4())
        self._data[sid] = {
            "title": "新对话",
            "messages": [],
            "updated_at": _now(),
        }
        return sid

    def ensure_session(self, session_id: str) -> None:
        if session_id not in self._data:
            self._data[session_id] = {
                "title": "新对话",
                "messages": [],
                "updated_at": _now(),
            }

    def list_sessions(self) -> list[dict[str, Any]]:
        items = [
            {"id": sid, "title": meta["title"], "updated_at": meta["updated_at"]}
            for sid, meta in self._data.items()
        ]
        items.sort(key=lambda x: x["updated_at"], reverse=True)
        return items

    def get_messages(self, session_id: str) -> list[dict[str, str]]:
        self.ensure_session(session_id)
        return list(self._data[session_id]["messages"])

    def add_message(self, session_id: str, role: str, content: str) -> None:
        self.ensure_session(session_id)
        entry = self._data[session_id]
        entry["messages"].append({"role": role, "content": content})
        entry["updated_at"] = _now()
        if role == "user" and entry["title"] == "新对话" and content.strip():
            t = content.strip().replace("\n", " ")
            entry["title"] = (t[:48] + "…") if len(t) > 48 else t

    def delete_session(self, session_id: str) -> bool:
        return self._data.pop(session_id, None) is not None

    def rename_session(self, session_id: str, title: str) -> bool:
        if session_id not in self._data:
            return False
        self._data[session_id]["title"] = (title.strip()[:200] or "新对话")
        self._data[session_id]["updated_at"] = _now()
        return True


session_service = SessionService()
