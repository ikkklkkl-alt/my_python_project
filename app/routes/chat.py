from fastapi import APIRouter
from app.services.ai_service import ask_ai

router = APIRouter()

@router.get("/chat")
def chat(q: str):

    answer = ask_ai(q)

    return {"question":q,
            "answer":answer}