from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from app.routes.chat import router as chat_router

app = FastAPI()

templates = Jinja2Templates(directory="templates")

app.include_router(chat_router)

@app.get("/")
async def home(request: Request):

    return templates.TemplateResponse(
        request = request,
        name = "index.html"
    )