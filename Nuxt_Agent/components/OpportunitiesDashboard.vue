<template>
  <div class="dashboard-container">
    <div class="dashboard-header animate-fade-in-up">
      <h2 class="dashboard-title">Salesforce <span class="gradient-text">Opportunities</span></h2>
      <p class="dashboard-subtitle">Overview of your recent and closed deals</p>
    </div>

    <div v-if="pending" class="loading-state">
      <div class="loader-pulse"></div>
      <p>Fetching data from Salesforce...</p>
    </div>
    
    <div v-else-if="error" class="error-state glass-card">
      <span class="error-icon">⚠️</span>
      <p>{{ error.message || 'Failed to load opportunities' }}</p>
      <button @click="refresh" class="btn-retry">Retry</button>
    </div>

    <div v-else class="dashboard-grid animate-fade-in-up delay-200">
      <!-- Recent Opportunities -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3>Recent Opportunities</h3>
          <span class="badge">Open Deals</span>
        </div>
        <div class="card-content">
          <ul class="opp-list">
            <li v-for="opp in recentOpps" :key="opp.Id" class="opp-item" @click="openModal(opp.Id)">
              <div class="opp-main">
                <span class="opp-name">{{ opp.Name }}</span>
                <span class="opp-stage" :class="getStageClass(opp.StageName)">{{ opp.StageName }}</span>
              </div>
              <div class="opp-meta">
                <span class="opp-amount">{{ formatCurrency(opp.Amount) }}</span>
                <span class="opp-date">{{ formatDate(opp.CloseDate) }}</span>
              </div>
            </li>
            <li v-if="!recentOpps.length" class="empty-state">No recent opportunities found.</li>
          </ul>
        </div>
      </div>

      <!-- Closed Opportunities -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3>Closed Opportunities</h3>
          <span class="badge badge-purple">Completed</span>
        </div>
        <div class="card-content">
          <ul class="opp-list">
            <li v-for="opp in closedOpps" :key="opp.Id" class="opp-item" @click="openModal(opp.Id)">
              <div class="opp-main">
                <span class="opp-name">{{ opp.Name }}</span>
                <span class="opp-stage" :class="opp.IsWon ? 'stage-won' : 'stage-lost'">
                  {{ opp.IsWon ? 'Closed Won' : 'Closed Lost' }}
                </span>
              </div>
              <div class="opp-meta">
                <span class="opp-amount" :class="{'text-success': opp.IsWon}">{{ formatCurrency(opp.Amount) }}</span>
                <span class="opp-date">{{ formatDate(opp.CloseDate) }}</span>
              </div>
            </li>
            <li v-if="!closedOpps.length" class="empty-state">No closed opportunities found.</li>
          </ul>
        </div>
      </div>
    </div>

    <OpportunityModal 
      :is-open="isModalOpen" 
      :opportunity-id="selectedOpportunityId" 
      @close="closeModal" 
      @saved="onModalSaved" 
    />
  </div>
</template>

<script setup>
const { data, pending, error, refresh } = await useFetch('/api/salesforce/opportunities')

const recentOpps = computed(() => data.value?.recent || [])
const closedOpps = computed(() => data.value?.closed || [])

const isModalOpen = ref(false)
const selectedOpportunityId = ref(null)

function openModal(id) {
  selectedOpportunityId.value = id
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  selectedOpportunityId.value = null
}

async function onModalSaved() {
  await refresh()
}

function getStageClass(stage) {
  const s = (stage || '').toLowerCase()
  if (s.includes('won')) return 'stage-won'
  if (s.includes('lost')) return 'stage-lost'
  if (s.includes('negotiation') || s.includes('review')) return 'stage-warning'
  return 'stage-default'
}
</script>

<style scoped>
.dashboard-container {
  padding: var(--space-2xl) 0;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.dashboard-title {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  margin-bottom: var(--space-sm);
}

.dashboard-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--space-xl);
}

.dashboard-card {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.card-header h3 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.badge {
  padding: 4px 12px;
  background: rgba(56, 189, 248, 0.15);
  color: var(--color-accent-cyan);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.badge-purple {
  background: rgba(168, 85, 247, 0.15);
  color: var(--color-accent-purple);
}

.opp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.opp-item {
  padding: var(--space-md);
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255,255,255,0.05);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.opp-item:hover {
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.2);
}

.opp-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-sm);
}

.opp-name {
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.opp-stage {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255,255,255,0.1);
}

.stage-won { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.stage-lost { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.stage-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.stage-default { color: var(--color-text-secondary); }

.opp-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.opp-amount { font-family: monospace; font-size: 1.1em; }
.text-success { color: #34d399; }

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-style: italic;
}

.loading-state, .error-state {
  text-align: center;
  padding: var(--space-3xl);
}

.loader-pulse {
  width: 40px; height: 40px;
  background: var(--gradient-accent);
  border-radius: 50%;
  margin: 0 auto var(--space-md);
  animation: float 2s infinite, pulseGlow 1.5s infinite;
}

.btn-retry {
  margin-top: var(--space-md);
  padding: 8px 16px;
  background: var(--gradient-accent);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
}
</style>
