<template>
  <div class="agent-chat-wrapper">
    <!-- Chat Panel -->
    <Transition name="chat-panel">
      <div v-if="isOpen" class="chat-panel glass-card">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar">
              <span class="chat-avatar-icon">◆</span>
              <span class="chat-avatar-status"></span>
            </div>
            <div>
              <h3 class="chat-title">Gravity Agent</h3>
              <span v-if="isAuthenticated" class="chat-status-text auth-success">Connected to Salesforce ✓</span>
              <span v-else class="chat-status-text">Online — Ask me anything</span>
            </div>
          </div>
          <div class="chat-header-actions">
            <a
              v-if="!isAuthenticated"
              href="/api/auth/login"
              class="sf-login-btn"
            >
              Connect Salesforce
            </a>
            <button
              id="agent-chat-close"
              class="chat-close-btn"
              @click="toggleChat"
              aria-label="Close chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="chat-messages">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="chat-message"
            :class="msg.role"
          >
            <div class="message-bubble" :class="msg.role">
              <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <span class="message-time">{{ msg.time }}</span>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="isTyping" class="chat-message bot">
            <div class="message-bubble bot typing-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input-area">
          <div class="chat-input-wrapper">
            <input
              id="agent-chat-input"
              v-model="inputMessage"
              type="text"
              placeholder="Type your question..."
              class="chat-input"
              @keyup.enter="sendMessage"
            />
            <button
              id="agent-chat-send"
              class="chat-send-btn"
              :disabled="!inputMessage.trim()"
              @click="sendMessage"
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 2-7 20-4-9-9-4z"/>
                <path d="m22 2-11 11"/>
              </svg>
            </button>
          </div>
          <span class="chat-powered-by">
            Powered by Google Gemini
          </span>
        </div>
      </div>
    </Transition>

    <!-- Floating Trigger Button -->
    <button
      id="agent-chat-trigger"
      class="chat-trigger-btn"
      :class="{ active: isOpen }"
      @click="toggleChat"
      aria-label="Open AI Assistant"
    >
      <Transition name="icon-swap" mode="out-in">
        <svg v-if="!isOpen" key="chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 10h.01"/>
          <path d="M12 10h.01"/>
          <path d="M16 10h.01"/>
        </svg>
        <svg v-else key="close" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </Transition>
      <span v-if="!isOpen" class="trigger-pulse"></span>
    </button>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useChatStore } from '~/stores/chat';
import { performLogout } from '~/utils/auth';

const chatStore = useChatStore();
const { isOpen, messages } = storeToRefs(chatStore);

const isTyping = ref(false)
const inputMessage = ref('')
const messagesContainer = ref(null)
const isAuthenticated = ref(false)

onMounted(async () => {
  try {
    const session = await $fetch('/api/auth/session')
    isAuthenticated.value = session.isAuthenticated
  } catch (e) {
    console.error('Failed to check session', e)
    if (e.response?.status === 401 || e.statusCode === 401) {
      performLogout(true)
    }
  }
})

function toggleChat() {
  chatStore.toggleChat()
}



function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function sendMessage() {
  const text = inputMessage.value.trim()
  if (!text) return

  chatStore.addMessage('user', text)
  inputMessage.value = ''
  scrollToBottom()

  // Simulate bot typing
  isTyping.value = true
  scrollToBottom()

  try {
    // Sliding Window Payload Optimization: Send only the last 6 messages to LLM to save tokens
    const recentMessages = messages.value.slice(-6).map(m => ({ role: m.role, content: m.content }))

    const response = await $fetch('/api/chat', {
      method: 'POST',
      body: {
        messages: recentMessages
      }
    })

    chatStore.addMessage('bot', response.reply || 'I am sorry, I did not understand that.')
  } catch (error) {
    console.error('Failed to get response:', error)
    if (error.response?.status === 401 || error.statusCode === 401) {
      performLogout(true)
      return
    }
    chatStore.addMessage('bot', 'Oops, something went wrong while communicating with the server.')
  } finally {
    isTyping.value = false
    scrollToBottom()
  }
}
</script>

<style scoped>
/* --- Chat Wrapper (fixed positioning context) --- */
.agent-chat-wrapper {
  position: fixed;
  bottom: var(--space-xl);
  right: var(--space-xl);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-md);
}

/* --- Floating Trigger Button --- */
.chat-trigger-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--gradient-accent);
  background-size: 200% 200%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-glow-cyan);
  transition: all var(--transition-base);
  animation: gradientShift 4s ease infinite;
  position: relative;
  flex-shrink: 0;
}

.chat-trigger-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 0 30px rgba(34, 211, 238, 0.5), 0 0 60px rgba(34, 211, 238, 0.2);
}

.chat-trigger-btn.active {
  background: var(--color-bg-tertiary);
  box-shadow: var(--shadow-lg);
}

.trigger-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(34, 211, 238, 0.4);
  animation: pulseGlow 2s ease-in-out infinite;
}

/* Icon swap transition */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: all 200ms ease;
}

.icon-swap-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}

.icon-swap-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}

/* --- Chat Panel --- */
.chat-panel {
  width: 380px;
  max-height: 560px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: absolute;
  bottom: 76px;
  right: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: var(--shadow-xl);
}

/* Panel transition */
.chat-panel-enter-active {
  animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.chat-panel-leave-active {
  animation: slideDown 0.25s ease both;
}

/* --- Chat Header --- */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(17, 24, 39, 0.5);
  flex-shrink: 0;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.chat-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(56, 189, 248, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.chat-avatar-icon {
  font-size: var(--font-size-sm);
  background: var(--gradient-accent);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.chat-avatar-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: #34d399;
  border-radius: 50%;
  border: 2px solid var(--color-bg-secondary);
}

.chat-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.chat-status-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.sf-login-btn {
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.sf-login-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  color: #fff;
}

.auth-success {
  color: #34d399 !important;
}

.chat-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.chat-close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

/* --- Messages Area --- */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-height: 300px;
  max-height: 360px;
}

.chat-message {
  display: flex;
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.bot {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 85%;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  animation: fadeInUp 0.3s ease-out both;
  position: relative;
}

.message-bubble.user {
  background: linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple));
  color: #fff;
  border-bottom-right-radius: var(--space-xs);
}

.message-bubble.bot {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
  border-bottom-left-radius: var(--space-xs);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.message-time {
  display: block;
  font-size: 10px;
  margin-top: var(--space-xs);
  opacity: 0.6;
  text-align: right;
}

/* --- Typing Indicator --- */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--space-sm) var(--space-md) !important;
}

.typing-indicator .dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent-cyan);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* --- Markdown Tables Support --- */
:deep(.markdown-body) {
  font-size: 0.95em;
  line-height: 1.5;
}

:deep(.markdown-body p) {
  margin-top: 0;
  margin-bottom: 0.5em;
}

:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.85em;
}

:deep(.markdown-body th), :deep(.markdown-body td) {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px;
  text-align: left;
}

:deep(.markdown-body th) {
  background: rgba(255,255,255,0.1);
  font-weight: 600;
}

/* --- Input Area --- */
.chat-input-area {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(17, 24, 39, 0.3);
  flex-shrink: 0;
}

.chat-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md);
  transition: border-color var(--transition-fast);
}

.chat-input-wrapper:focus-within {
  border-color: rgba(56, 189, 248, 0.3);
}

.chat-input {
  flex: 1;
  padding: var(--space-sm) 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.chat-input::placeholder {
  color: var(--color-text-muted);
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  background-size: 200% 200%;
  color: #fff;
  transition: all var(--transition-base);
  animation: gradientShift 4s ease infinite;
  flex-shrink: 0;
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-send-btn:not(:disabled):hover {
  transform: scale(1.08);
  box-shadow: var(--shadow-glow-cyan);
}

.chat-powered-by {
  display: block;
  text-align: center;
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: var(--space-sm);
  opacity: 0.6;
}

/* --- Responsive --- */
@media (max-width: 480px) {
  .agent-chat-wrapper {
    bottom: var(--space-md);
    right: var(--space-md);
  }

  .chat-panel {
    width: calc(100vw - 2 * var(--space-md));
    max-height: calc(100vh - 120px);
    right: 0;
  }

  .chat-trigger-btn {
    width: 52px;
    height: 52px;
  }
}
</style>
