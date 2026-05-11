# AI Chat Web App

基于 FastAPI 的类 ChatGPT 对话 Web 应用，支持多会话、流式回复、Markdown 与代码高亮、深浅色主题。兼容任意 **OpenAI Chat Completions** 接口（默认示例为 DeepSeek）。

## 功能

- 侧栏多会话：新建、切换、重命名、删除
- 流式输出（SSE 解析），可停止生成
- 会话上下文自动带上历史消息
- Markdown 渲染、代码块高亮与一键复制
- 前端 DOMPurify 降低 XSS 风险
- 会话数据保存在服务器内存（进程重启后清空）

## 技术栈

- FastAPI、Jinja2、Uvicorn
- 原生 JavaScript（无构建步骤）
- `requests` 调用 OpenAI 兼容 `/v1/chat/completions`

## 环境变量

复制 `.env.example` 为 `.env` 并填写密钥：

| 变量 | 说明 |
|------|------|
| `AI_API_KEY` | 推荐；也可使用 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` |
| `AI_BASE_URL` | 接口根地址，如 `https://api.deepseek.com`（不要带末尾 `/v1` 时由程序拼接 `/v1/chat/completions`；若填写已含 `/v1` 的地址亦可） |
| `AI_MODEL` | 如 `deepseek-chat` 或各服务商模型名 |

未配置密钥时，页面仍可打开，接口会返回提示文案而非真实模型回复。

## 运行

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

浏览器访问 <http://127.0.0.1:8000>。

## API 摘要（供联调或扩展）

- `GET /api/sessions` — 会话列表  
- `POST /api/sessions` — 新建会话  
- `GET /api/sessions/{id}/messages` — 消息列表  
- `PATCH /api/sessions/{id}` — 重命名，`{"title":"..."}`  
- `DELETE /api/sessions/{id}` — 删除会话  
- `POST /api/chat/stream` — 流式对话，`{"session_id":"...","message":"..."}`  
- `POST /api/chat` — 非流式对话（同上 JSON）
