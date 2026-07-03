import { useChatStore } from '~/stores/chat'

export async function performLogout(isExpired = false) {
  await $fetch('/api/auth/logout', { method: 'POST' })
  if (!isExpired) {
    useChatStore().clearChat()
  }
  if (import.meta.client) {
    if (isExpired) {
      window.location.href = '/?expired=true'
    } else {
      window.location.href = '/'
    }
  }
}
