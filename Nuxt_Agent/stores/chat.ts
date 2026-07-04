import { defineStore } from 'pinia';

export const useChatStore = defineStore('chat', {
  state: () => ({
    isOpen: false,
    messages: [
      {
        role: 'bot',
        content:
          'Hi there! 👋 I\'m the Gravity Agent. Ask me anything about your data — like "show last month\'s revenue" or "find contact John Doe".',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]
  }),
  actions: {
    toggleChat() {
      this.isOpen = !this.isOpen;
    },
    addMessage(role: string, content: string) {
      this.messages.push({
        role,
        content,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    },
    clearChat() {
      this.messages = [
        {
          role: 'bot',
          content: "Hi! I'm your Gravity Agent. How can I help you today?",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ];
    }
  },
  persist: true,
});
