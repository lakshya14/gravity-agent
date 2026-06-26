<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content glass-card animate-fade-in-up delay-100">
        <div class="modal-header">
          <h3>Edit Opportunity</h3>
          <button class="btn-close" @click="close">&times;</button>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="loader-pulse"></div>
          <p>Loading details...</p>
        </div>

        <div v-else-if="errorMsg" class="error-state">
          <span class="error-icon">⚠️</span>
          <p>{{ errorMsg }}</p>
          <button v-if="!recordData" @click="close" class="btn-secondary">Close</button>
        </div>

        <form v-else @submit.prevent="save" class="modal-body">
          <div class="form-group">
            <label for="oppName">Opportunity Name</label>
            <input id="oppName" v-model="formData.Name" type="text" />
          </div>

          <div class="form-group">
            <label for="oppAmount">Amount</label>
            <div class="input-with-icon">
              <span class="currency-symbol">$</span>
              <input id="oppAmount" v-model="formData.Amount" type="number" step="0.01" />
            </div>
          </div>

          <div class="form-group">
            <label for="oppStage">Stage</label>
            <select id="oppStage" v-model="formData.StageName">
              <option value="Prospecting">Prospecting</option>
              <option value="Qualification">Qualification</option>
              <option value="Needs Analysis">Needs Analysis</option>
              <option value="Value Proposition">Value Proposition</option>
              <option value="Id. Decision Makers">Id. Decision Makers</option>
              <option value="Perception Analysis">Perception Analysis</option>
              <option value="Proposal/Price Quote">Proposal/Price Quote</option>
              <option value="Negotiation/Review">Negotiation/Review</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
            </select>
          </div>

          <div class="form-group">
            <label for="oppCloseDate">Close Date</label>
            <input id="oppCloseDate" v-model="formData.CloseDate" type="date" />
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="close" :disabled="saving">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              <span v-if="saving">Saving...</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { performLogout } from '~/utils/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  opportunityId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const recordData = ref(null)

const formData = reactive({
  Name: '',
  Amount: null,
  StageName: '',
  CloseDate: ''
})

watch(() => props.isOpen, async (newVal) => {
  if (newVal && props.opportunityId) {
    await fetchOpportunityDetails()
  } else {
    resetState()
  }
})

function resetState() {
  loading.value = false
  saving.value = false
  errorMsg.value = ''
  recordData.value = null
  Object.keys(formData).forEach(key => formData[key] = '')
}

function close() {
  emit('close')
}

async function fetchOpportunityDetails() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await $fetch(`/api/salesforce/opportunity/${props.opportunityId}`)
    recordData.value = data
    // Populate form data
    formData.Name = data.Name || ''
    formData.Amount = data.Amount || null
    formData.StageName = data.StageName || ''
    formData.CloseDate = data.CloseDate ? data.CloseDate.split('T')[0] : ''
  } catch (err) {
    console.error(err)
    if (err.response?.status === 401 || err.statusCode === 401) {
      performLogout()
      return
    }
    errorMsg.value = err.data?.statusMessage || err.message || 'Failed to load opportunity details.'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  errorMsg.value = ''
  
  // Create payload with only the allowed fields
  const payload = {
    Name: formData.Name,
    Amount: formData.Amount ? Number(formData.Amount) : null,
    StageName: formData.StageName,
    CloseDate: formData.CloseDate || null
  }

  try {
    await $fetch(`/api/salesforce/opportunity/${props.opportunityId}`, {
      method: 'PATCH',
      body: payload
    })
    emit('saved')
    close()
  } catch (err) {
    console.error(err)
    if (err.response?.status === 401 || err.statusCode === 401) {
      performLogout()
      return
    }
    // Here we catch the specific Salesforce validation errors that our backend returned
    errorMsg.value = err.data?.statusMessage || err.message || 'Failed to save changes.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-tertiary);
  width: 90%;
  max-width: 500px;
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: var(--space-md);
}

.modal-header h3 {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.btn-close {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--color-text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

input, select {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--color-accent-cyan);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.disabled-input {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 12px;
  color: var(--color-text-secondary);
}

.input-with-icon input {
  padding-left: 28px;
  width: 100%;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--gradient-accent);
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state, .error-state {
  text-align: center;
  padding: var(--space-2xl) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.error-state {
  color: #ef4444;
}

.error-icon {
  font-size: 32px;
}

.loader-pulse {
  width: 40px; height: 40px;
  background: var(--gradient-accent);
  border-radius: 50%;
  animation: pulseGlow 1.5s infinite;
}
</style>
