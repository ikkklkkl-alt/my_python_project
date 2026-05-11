(function () {
    "use strict";

    const LS_SESSION = "ai_chat_session_id";
    const LS_THEME = "ai_chat_theme";
    const LS_SIDEBAR = "ai_chat_sidebar_collapsed";

    const messagesEl = document.getElementById("messages");
    const sessionListEl = document.getElementById("sessionList");
    const inputEl = document.getElementById("input");
    const btnSend = document.getElementById("btnSend");
    const btnStop = document.getElementById("btnStop");
    const btnNewChat = document.getElementById("btnNewChat");
    const btnDeleteChat = document.getElementById("btnDeleteChat");
    const btnRename = document.getElementById("btnRename");
    const mainTitle = document.getElementById("mainTitle");
    const sidebar = document.getElementById("sidebar");
    const btnCollapseSidebar = document.getElementById("btnCollapseSidebar");
    const btnOpenSidebar = document.getElementById("btnOpenSidebar");
    const btnTheme = document.getElementById("btnTheme");
    const modalBackdrop = document.getElementById("modalBackdrop");
    const renameModal = document.getElementById("renameModal");
    const renameInput = document.getElementById("renameInput");
    const renameCancel = document.getElementById("renameCancel");
    const renameSave = document.getElementById("renameSave");
    const hljsThemeLink = document.getElementById("hljs-theme");

    let currentSessionId = null;
    let sessionsCache = [];
    let streamAbort = null;
    let streaming = false;

    marked.setOptions({ gfm: true, breaks: true });

    async function apiJson(path, options = {}) {
        const res = await fetch(path, {
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            ...options,
        });
        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error(text || res.statusText);
        }
        if (!res.ok) {
            let msg = data.detail ?? data.error ?? text ?? res.statusText;
            if (Array.isArray(msg)) {
                msg = msg.map((x) => x.msg || JSON.stringify(x)).join("; ");
            }
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        return data;
    }

    function setTheme(theme) {
        const isLight = theme === "light";
        document.body.classList.toggle("theme-light", isLight);
        document.body.classList.toggle("theme-dark", !isLight);
        hljsThemeLink.href = isLight
            ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"
            : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css";
        localStorage.setItem(LS_THEME, theme);
    }

    function loadTheme() {
        const t = localStorage.getItem(LS_THEME);
        setTheme(t === "light" ? "light" : "dark");
    }

    function toggleTheme() {
        const next = document.body.classList.contains("theme-light") ? "dark" : "light";
        setTheme(next);
    }

    function setSidebarCollapsed(collapsed) {
        sidebar.classList.toggle("collapsed", collapsed);
        localStorage.setItem(LS_SIDEBAR, collapsed ? "1" : "0");
    }

    function loadSidebarState() {
        setSidebarCollapsed(localStorage.getItem(LS_SIDEBAR) === "1");
    }

    function scrollToBottom() {
        const wrap = messagesEl.closest(".messages-wrap");
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
    }

    function renderMarkdown(text, container) {
        const dirty = marked.parse(text || "");
        const clean = DOMPurify.sanitize(dirty);
        container.innerHTML = `<div class="md-content">${clean}</div>`;
        container.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
        });
        container.querySelectorAll("pre").forEach((pre) => {
            if (pre.querySelector(".copy-code-btn")) return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-code-btn";
            btn.textContent = "复制";
            btn.addEventListener("click", async () => {
                const code = pre.querySelector("code");
                const t = code ? code.innerText : pre.innerText;
                try {
                    await navigator.clipboard.writeText(t);
                    btn.textContent = "已复制";
                    setTimeout(() => { btn.textContent = "复制"; }, 2000);
                } catch {
                    btn.textContent = "失败";
                    setTimeout(() => { btn.textContent = "复制"; }, 2000);
                }
            });
            pre.style.position = "relative";
            pre.appendChild(btn);
        });
    }

    function addMessageRow(role, text, opts = {}) {
        const row = document.createElement("div");
        row.className = `msg-row ${role}`;
        const av = document.createElement("div");
        av.className = "msg-avatar";
        av.textContent = role === "user" ? "我" : "AI";
        const body = document.createElement("div");
        body.className = "msg-body";
        if (role === "user") {
            body.classList.add("user-plain");
            body.textContent = text;
        } else {
            if (opts.typing) {
                body.innerHTML =
                    '<div class="typing-indicator" aria-label="正在输入"><span></span><span></span><span></span></div>';
            } else {
                renderMarkdown(text, body);
            }
        }
        row.appendChild(av);
        row.appendChild(body);
        messagesEl.appendChild(row);
        scrollToBottom();
        return { row, body };
    }

    function clearMessages() {
        messagesEl.innerHTML = "";
    }

    function setStreamingUI(on) {
        streaming = on;
        btnSend.disabled = on;
        inputEl.disabled = on;
        btnStop.hidden = !on;
    }

    function resizeInput() {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
    }

    function updateTitleFromSessions() {
        const s = sessionsCache.find((x) => x.id === currentSessionId);
        mainTitle.textContent = s ? s.title : "新对话";
    }

    function renderSessionList() {
        sessionListEl.innerHTML = "";
        sessionsCache.forEach((s) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "session-item" + (s.id === currentSessionId ? " active" : "");
            btn.dataset.id = s.id;
            const span = document.createElement("span");
            span.className = "session-item-title";
            span.textContent = s.title;
            btn.appendChild(span);
            btn.addEventListener("click", () => switchSession(s.id));
            sessionListEl.appendChild(btn);
        });
    }

    async function refreshSessions() {
        const data = await apiJson("/api/sessions");
        sessionsCache = data.sessions || [];
        renderSessionList();
        updateTitleFromSessions();
    }

    async function loadMessages(sessionId) {
        const data = await apiJson(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
        clearMessages();
        (data.messages || []).forEach((m) => {
            if (m.role === "user" || m.role === "assistant") {
                addMessageRow(m.role === "user" ? "user" : "ai", m.content || "");
            }
        });
        scrollToBottom();
    }

    async function switchSession(sessionId) {
        if (streaming) return;
        currentSessionId = sessionId;
        localStorage.setItem(LS_SESSION, sessionId);
        await loadMessages(sessionId);
        renderSessionList();
        updateTitleFromSessions();
        if (window.innerWidth <= 768) setSidebarCollapsed(true);
    }

    async function ensureSession() {
        let sid = localStorage.getItem(LS_SESSION);
        await refreshSessions();
        if (sid && sessionsCache.some((x) => x.id === sid)) {
            await switchSession(sid);
            return;
        }
        if (sessionsCache.length > 0) {
            await switchSession(sessionsCache[0].id);
            return;
        }
        const created = await apiJson("/api/sessions", { method: "POST" });
        sid = created.id;
        localStorage.setItem(LS_SESSION, sid);
        await refreshSessions();
        await switchSession(sid);
    }

    async function onNewChat() {
        if (streaming) return;
        const created = await apiJson("/api/sessions", { method: "POST" });
        localStorage.setItem(LS_SESSION, created.id);
        await refreshSessions();
        await switchSession(created.id);
        inputEl.focus();
    }

    async function onDeleteChat() {
        if (!currentSessionId || streaming) return;
        if (!confirm("确定删除当前对话？")) return;
        await apiJson(`/api/sessions/${encodeURIComponent(currentSessionId)}`, { method: "DELETE" });
        localStorage.removeItem(LS_SESSION);
        await refreshSessions();
        if (sessionsCache.length > 0) {
            await switchSession(sessionsCache[0].id);
            localStorage.setItem(LS_SESSION, currentSessionId);
        } else {
            const created = await apiJson("/api/sessions", { method: "POST" });
            currentSessionId = created.id;
            localStorage.setItem(LS_SESSION, currentSessionId);
            await refreshSessions();
            clearMessages();
            updateTitleFromSessions();
        }
    }

    async function sendStream() {
        const text = inputEl.value.trim();
        if (!text || !currentSessionId || streaming) return;

        addMessageRow("user", text);
        inputEl.value = "";
        resizeInput();

        const { body: aiBody } = addMessageRow("ai", "", { typing: true });
        setStreamingUI(true);

        const ac = new AbortController();
        streamAbort = ac;

        let fullText = "";
        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: currentSessionId, message: text }),
                signal: ac.signal,
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || res.statusText);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            aiBody.innerHTML = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
                renderMarkdown(fullText, aiBody);
                scrollToBottom();
            }
        } catch (e) {
            if (e.name === "AbortError") {
                aiBody.innerHTML = "";
                renderMarkdown((fullText || "").trim() ? fullText + "\n\n*（已停止）*" : "*（已停止）*", aiBody);
            } else {
                aiBody.innerHTML = "";
                renderMarkdown("**错误** " + String(e.message || e), aiBody);
            }
        } finally {
            streamAbort = null;
            setStreamingUI(false);
            await refreshSessions();
            scrollToBottom();
        }
    }

    function openRenameModal() {
        const s = sessionsCache.find((x) => x.id === currentSessionId);
        renameInput.value = s ? s.title : "";
        renameModal.hidden = false;
        modalBackdrop.hidden = false;
        renameInput.focus();
        renameInput.select();
    }

    function closeRenameModal() {
        renameModal.hidden = true;
        modalBackdrop.hidden = true;
    }

    async function saveRename() {
        const title = renameInput.value.trim();
        if (!title || !currentSessionId) return;
        await apiJson(`/api/sessions/${encodeURIComponent(currentSessionId)}`, {
            method: "PATCH",
            body: JSON.stringify({ title }),
        });
        closeRenameModal();
        await refreshSessions();
    }

    btnSend.addEventListener("click", sendStream);
    inputEl.addEventListener("input", resizeInput);
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendStream();
        }
    });

    btnStop.addEventListener("click", () => {
        if (streamAbort) streamAbort.abort();
    });

    btnNewChat.addEventListener("click", onNewChat);
    btnDeleteChat.addEventListener("click", onDeleteChat);
    btnRename.addEventListener("click", openRenameModal);
    renameCancel.addEventListener("click", closeRenameModal);
    renameSave.addEventListener("click", saveRename);
    modalBackdrop.addEventListener("click", closeRenameModal);
    renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveRename();
        if (e.key === "Escape") closeRenameModal();
    });

    btnCollapseSidebar.addEventListener("click", () => setSidebarCollapsed(true));
    btnOpenSidebar.addEventListener("click", () => setSidebarCollapsed(false));
    btnTheme.addEventListener("click", toggleTheme);

    loadTheme();
    loadSidebarState();
    ensureSession().catch((e) => {
        addMessageRow("ai", "**无法连接服务** " + String(e.message || e));
    });

    resizeInput();
})();
