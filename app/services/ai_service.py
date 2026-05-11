import json
import os
from typing import Callable, Iterator, List

import requests

# Prefer generic AI_*; fall back to DeepSeek / OpenAI-style env names
API_KEY = (
    os.getenv("AI_API_KEY")
    or os.getenv("DEEPSEEK_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or ""
)
BASE_URL = (
    os.getenv("AI_BASE_URL")
    or os.getenv("OPENAI_BASE_URL")
    or "https://api.deepseek.com"
).rstrip("/")
MODEL_NAME = os.getenv("AI_MODEL") or os.getenv("OPENAI_MODEL") or "deepseek-chat"


def _chat_completions_url() -> str:
    base = BASE_URL.rstrip("/")
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def ask_ai(messages: List[dict]) -> str:
    if not API_KEY:
        return "（未配置 API 密钥）请在环境变量中设置 AI_API_KEY、DEEPSEEK_API_KEY 或 OPENAI_API_KEY。"

    payload = {"model": MODEL_NAME, "messages": messages}
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post(_chat_completions_url(), json=payload, headers=headers, timeout=120)
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"].get("content", "") or ""
    except Exception as e:
        return f"请求失败：{e}"


def ask_ai_stream(messages: List[dict]) -> Callable[[], Iterator[str]]:
    def generate() -> Iterator[str]:
        if not API_KEY:
            yield "（未配置 API 密钥）请在 .env 中配置 AI_API_KEY（或 DEEPSEEK_API_KEY / OPENAI_API_KEY）。"
            return

        payload = {"model": MODEL_NAME, "messages": messages, "stream": True}
        headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
        try:
            with requests.post(
                _chat_completions_url(),
                json=payload,
                headers=headers,
                stream=True,
                timeout=120,
            ) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line:
                        continue
                    line_s = line.decode("utf-8").strip()
                    if line_s.startswith("data: "):
                        line_s = line_s[6:]
                    if line_s == "[DONE]":
                        break
                    try:
                        data = json.loads(line_s)
                        delta = data["choices"][0].get("delta") or {}
                        content = delta.get("content")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
        except Exception as e:
            yield f"流式请求失败：{e}"

    return generate
