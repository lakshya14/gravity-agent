<template>
  <div class="landing-page">
    <!-- Ambient background effects -->
    <div class="ambient-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Navigation -->
    <nav class="navbar animate-fade-in">
      <div class="container navbar-inner">
        <div class="navbar-brand">
          <span class="brand-icon">◆</span>
          <span class="brand-text">Gravity</span>
        </div>
        <div class="navbar-links">
          <a v-if="!isAuthenticated" href="/api/auth/login" class="login-link">Login to Salesforce</a>
          <a v-else href="#" @click.prevent="logout" class="logout-link">Logout</a>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section v-if="!isAuthenticated" class="hero section">
      <div class="container hero-content">
        <div class="hero-badge animate-fade-in-up">
          <span class="badge-dot"></span>
          <span>Powered by AI</span>
        </div>

        <h1 class="hero-title animate-fade-in-up delay-100">
          Search Smarter with
          <span class="gradient-text">Gravity</span>
        </h1>

        <p class="hero-subtitle animate-fade-in-up delay-200">
          Your intelligent search platform. Ask questions in natural language
          and get instant, accurate answers powered by cutting-edge AI.
        </p>

        <!-- Search Bar -->
        <div class="search-wrapper animate-fade-in-up delay-300">
          <a href="/api/auth/login" class="search-btn login-btn">
            Connect to Salesforce to Start
          </a>
        </div>
      </div>
    </section>

    <!-- Dashboard Section -->
    <section v-else class="section">
      <div class="container">
        <OpportunitiesDashboard />
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features section">
      <div class="container">
        <div class="section-header animate-fade-in-up">
          <h2 class="section-title">
            Why Choose <span class="gradient-text">Gravity</span>
          </h2>
          <p class="section-subtitle">
            Built for teams who need fast, intelligent access to their data
          </p>
        </div>

        <div class="features-grid">
          <div
            v-for="(feature, index) in features"
            :key="feature.title"
            class="feature-card glass-card animate-fade-in-up"
            :class="`delay-${(index + 1) * 100}`"
          >
            <div class="feature-icon-wrapper">
              <span class="feature-icon" v-html="feature.icon"></span>
            </div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
            <div class="feature-card-glow"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section id="about" class="cta-section section">
      <div class="container">
        <div class="cta-card glass-card animate-fade-in-up">
          <div class="cta-content">
            <h2 class="cta-title">Ready to transform your search experience?</h2>
            <p class="cta-subtitle">
              Start using our AI-powered assistant today. Click the chat button
              in the bottom right to begin a conversation.
            </p>
            <div class="cta-arrow">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer id="contact" class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <span class="brand-icon">◆</span>
          <span class="brand-text">Gravity</span>
        </div>
        <p class="footer-copy">
          &copy; {{ new Date().getFullYear() }} Gravity. Intelligent search, reimagined.
        </p>
        <div class="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
const { data: sessionData } = await useFetch('/api/auth/session')

const isAuthenticated = computed(() => sessionData.value?.isAuthenticated || false)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  window.location.reload()
}

const features = [
  {
    icon: '⚡',
    title: 'Natural Language Search',
    description:
      'Ask questions the way you naturally speak. No complex query syntax needed — our AI understands context and intent.',
  },
  {
    icon: '🔗',
    title: 'Salesforce Integration',
    description:
      'Seamlessly connected to your Salesforce data. Pull reports, find records, and get insights without leaving the platform.',
  },
  {
    icon: '🛡️',
    title: 'Enterprise Security',
    description:
      'Built with enterprise-grade security. Your data stays protected with role-based access controls and encryption at rest.',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    description:
      'Get instant dashboards and visualizations. Transform raw data into actionable insights with a single question.',
  },
]
</script>

<style scoped>
/* --- Ambient Background --- */
.landing-page {
  position: relative;
  min-height: 100vh;
}

.ambient-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.4;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.15), transparent 70%);
  top: -10%;
  right: -5%;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.12), transparent 70%);
  bottom: 10%;
  left: -5%;
  animation-delay: -7s;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.1), transparent 70%);
  top: 50%;
  left: 40%;
  animation-delay: -14s;
}

/* --- Navbar --- */
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: var(--space-md) 0;
  background: rgba(10, 14, 26, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.brand-icon {
  font-size: var(--font-size-xl);
  background: var(--gradient-accent);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 4s ease infinite;
}

.brand-text {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.navbar-links {
  display: flex;
  gap: var(--space-xl);
}

.navbar-links a {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: color var(--transition-fast);
  position: relative;
}

.navbar-links a::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--gradient-accent);
  transition: width var(--transition-base);
  border-radius: var(--radius-full);
}

.navbar-links a:hover {
  color: var(--color-text-primary);
}

.navbar-links a:hover::after {
  width: 100%;
}

/* --- Hero --- */
.hero {
  position: relative;
  z-index: 1;
  padding-top: var(--space-4xl);
  padding-bottom: var(--space-3xl);
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin-inline: auto;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-accent-cyan);
  margin-bottom: var(--space-xl);
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent-cyan);
  border-radius: 50%;
  animation: pulseGlow 2s ease-in-out infinite;
}

.hero-title {
  font-size: var(--font-size-6xl);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: var(--space-lg);
  color: var(--color-text-primary);
}

.hero-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin-inline: auto;
  margin-bottom: var(--space-2xl);
  line-height: 1.7;
}

/* --- Search Bar --- */
.search-wrapper {
  margin-bottom: var(--space-2xl);
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--color-bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl);
  padding: var(--space-xs);
  padding-left: var(--space-lg);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.search-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-2xl);
  padding: 1px;
  background: linear-gradient(135deg, transparent 40%, rgba(56, 189, 248, 0.3), rgba(168, 85, 247, 0.3));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.search-bar.focused {
  border-color: rgba(56, 189, 248, 0.3);
  box-shadow: var(--shadow-glow-cyan);
}

.search-bar.focused::before {
  opacity: 1;
}

.search-icon {
  color: var(--color-text-muted);
  display: flex;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.search-bar.focused .search-icon {
  color: var(--color-accent-cyan);
}

.search-input {
  flex: 1;
  padding: var(--space-md) var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-btn {
  padding: var(--space-sm) var(--space-xl);
  background: var(--gradient-accent);
  background-size: 200% 200%;
  color: #fff;
  font-weight: 600;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-xl);
  transition: all var(--transition-base);
  animation: gradientShift 4s ease infinite;
  white-space: nowrap;
}

.search-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-glow-cyan);
}

.search-hints {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.hint-tag {
  padding: var(--space-xs) var(--space-sm);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.hint-tag:hover {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
  color: var(--color-accent-cyan);
}

/* --- Hero Stats --- */
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xl);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
}

/* --- Section Header --- */
.section-header {
  text-align: center;
  margin-bottom: var(--space-3xl);
}

.section-title {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-md);
}

.section-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  max-width: 500px;
  margin-inline: auto;
}

/* --- Features Grid --- */
.features {
  position: relative;
  z-index: 1;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-lg);
}

.feature-card {
  padding: var(--space-xl);
  position: relative;
  overflow: hidden;
}

.feature-card-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.06), transparent 60%);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.feature-card:hover .feature-card-glow {
  opacity: 1;
}

.feature-icon-wrapper {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(56, 189, 248, 0.1);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-lg);
  font-size: var(--font-size-xl);
  transition: transform var(--transition-spring);
}

.feature-card:hover .feature-icon-wrapper {
  transform: scale(1.1) rotate(-3deg);
}

.feature-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.feature-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
}

/* --- CTA Section --- */
.cta-section {
  position: relative;
  z-index: 1;
}

.cta-card {
  padding: var(--space-3xl);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.08), transparent 60%);
}

.cta-content {
  position: relative;
  z-index: 1;
}

.cta-title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin-bottom: var(--space-md);
  letter-spacing: -0.02em;
}

.cta-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  max-width: 500px;
  margin-inline: auto;
  margin-bottom: var(--space-xl);
  line-height: 1.7;
}

.cta-arrow {
  color: var(--color-accent-purple);
  animation: float 2s ease-in-out infinite;
  display: inline-flex;
}

/* --- Footer --- */
.site-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: var(--space-xl) 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.footer-copy {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.footer-links {
  display: flex;
  gap: var(--space-lg);
}

.footer-links a {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.footer-links a:hover {
  color: var(--color-text-primary);
}

/* --- Responsive --- */
@media (max-width: 768px) {
  .navbar-links {
    display: none;
  }

  .hero-stats {
    flex-direction: column;
    gap: var(--space-md);
  }

  .stat-divider {
    width: 40px;
    height: 1px;
  }

  .footer-inner {
    flex-direction: column;
    text-align: center;
  }

  .search-bar {
    flex-direction: column;
    padding: var(--space-sm);
    border-radius: var(--radius-xl);
    gap: var(--space-sm);
  }

  .search-icon {
    display: none;
  }

  .search-input {
    text-align: center;
  }

  .search-btn {
    width: 100%;
    padding: var(--space-md);
    border-radius: var(--radius-lg);
  }
}
</style>
