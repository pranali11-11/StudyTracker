// --- StudyBot: Your Personal Study Assistant ---
const GEMINI_API_KEY = 'AIzaSyCGizJauXLVSn0KpgfeplJIrS9-FfYr1u4';

const botToggle = document.getElementById('study-bot-toggle');
const botContainer = document.getElementById('study-bot-container');
const botClose = document.getElementById('close-bot');
const botMessages = document.getElementById('bot-messages');
const botInput = document.getElementById('bot-input');
const botSend = document.getElementById('btn-send-bot');

let isBotOpen = false;
let chatHistory = [];

const SYSTEM_PROMPT = `You are StudyBot — a smart, friendly AI assistant embedded inside StudyMaster, a student study planner app.

Your job is to:
- Answer academic questions clearly and accurately (Math, Science, History, English, Programming, Economics, Biology, Chemistry, etc.)
- Help students understand concepts with examples and simple explanations
- Assist with study planning, timers, and productivity
- Be encouraging and warm

Rules:
- Give REALISTIC, ACCURATE, HELPFUL answers
- Keep replies concise and easy to understand
- Use examples when explaining concepts
- Use 1-2 emojis to stay friendly
- NEVER make up wrong information — if unsure, say so honestly`;

// Toggle Logic
botToggle.addEventListener('click', () => {
    isBotOpen = !isBotOpen;
    botContainer.classList.toggle('hidden', !isBotOpen);
    if (isBotOpen) botInput.focus();
});

botClose.addEventListener('click', () => {
    isBotOpen = false;
    botContainer.classList.add('hidden');
});

// Send Message
async function sendMessage() {
    const text = botInput.value.trim();
    if (!text) return;

    if (!GEMINI_API_KEY) {
        addMessageToUI("⚠️ API Key not found. Please restart your dev server.", 'bot');
        return;
    }

    addMessageToUI(text, 'user');
    botInput.value = '';
    botInput.disabled = true;
    botSend.disabled = true;

    const typingId = showTypingIndicator();
    const context = await getStudentContext();

    // Add user message to persistent history
    chatHistory.push({ role: "user", parts: [{ text: `[Student: ${context.name} | Tasks: ${context.tasks} | Focus: ${context.focus} | Streak: ${context.streak}]\n\n${text}` }] });

    const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];
    let success = false;
    let lastErr = 'Unknown error';

    for (const model of models) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        contents: chatHistory
                    })
                }
            );

            const data = await res.json();

            if (data.error) {
                console.error(`Model ${model} error:`, data.error.message);
                if (data.error.message.toLowerCase().includes("not found")) continue;
                throw new Error(data.error.message);
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hmm, I didn't get a response. Try again!";
            chatHistory.push({ role: "model", parts: [{ text: reply }] });

            removeTypingIndicator(typingId);
            addMessageToUI(reply, 'bot');
            success = true;
            break;

        } catch (err) {
            lastErr = err.message;
            console.error(`Model ${model} failed:`, err.message);
        }
    }

    if (!success) {
        chatHistory.pop();
        removeTypingIndicator(typingId);
        addMessageToUI(`❌ Error: ${lastErr}`, 'bot');
    }

    botInput.disabled = false;
    botSend.disabled = false;
    botInput.focus();
}

function addMessageToUI(text, role) {
    const div = document.createElement('div');
    div.className = `bot-message ${role}`;
    if (role === 'bot') {
        div.innerHTML = parseMarkdown(text);
    } else {
        div.textContent = text;
    }
    botMessages.appendChild(div);
    botMessages.scrollTop = botMessages.scrollHeight;
}

function parseMarkdown(text) {
    return text
        // Code blocks (```...```)
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code (`code`)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold (**text** or __text__)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        // Italic (*text* or _text_)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Headings
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h3>$1</h3>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(?!<[a-z])/m, '<p>')
        + '</p>';
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'bot-message bot';
    el.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    botMessages.appendChild(el);
    botMessages.scrollTop = botMessages.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
}

botSend.addEventListener('click', sendMessage);
botInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function getStudentContext() {
    return {
        name: document.querySelector('.user-name')?.textContent || "Student",
        focus: document.getElementById('dash-total-time')?.textContent || "0h 0m",
        streak: document.getElementById('dash-streak')?.textContent || "0 Days",
        tasks: Array.from(document.querySelectorAll('#dashboard-task-list .task-item'))
                    .map(el => el.querySelector('.task-title')?.textContent).join(', ') || "none"
    };
}
