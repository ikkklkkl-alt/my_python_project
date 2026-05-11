from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.ai_service import ask_ai, ask_ai_stream
from app.services.session_service import session_service

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=32000)


class RenameSessionBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


@router.get("/sessions")
async def list_sessions():
    return {"sessions": session_service.list_sessions()}


@router.post("/sessions")
async def create_session():
    sid = session_service.create_session()
    return {"id": sid}


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    session_service.ensure_session(session_id)
    return {"messages": session_service.get_messages(session_id)}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    if not session_service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"ok": True}


@router.patch("/sessions/{session_id}")
async def rename_session(session_id: str, body: RenameSessionBody):
    if not session_service.rename_session(session_id, body.title):
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"ok": True}


@router.post("/chat")
async def chat(req: ChatRequest):
    session_service.add_message(req.session_id, "user", req.message)
    history = session_service.get_messages(req.session_id)
    reply = ask_ai(history)
    session_service.add_message(req.session_id, "assistant", reply)
    return {"reply": reply}


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    session_service.add_message(req.session_id, "user", req.message)
    history = session_service.get_messages(req.session_id)
    inner = ask_ai_stream(history)

    def generate():
        buf: list[str] = []
        try:
            for chunk in inner():
                buf.append(chunk)
                yield chunk
        finally:
            text = "".join(buf).strip()
            if text:
                session_service.add_message(req.session_id, "assistant", text)

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
