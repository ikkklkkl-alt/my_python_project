import os
import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.routes.chat import router as chat_router

load_dotenv()

app = FastAPI(title="AI Chat", description="类 ChatGPT 的对话 Web 应用")

app.include_router(chat_router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html", {})


@app.exception_handler(Exception)
async def all_exception_handler(request: Request, exc: Exception):
    print(traceback.format_exc())
    return JSONResponse(status_code=500, content={"error": str(exc)})
