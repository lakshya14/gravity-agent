# Gravity Agent - Learning Journal

This journal captures architectural patterns, technologies, and concepts. 
The core philosophy is to focus on **trade-offs**: understanding *when to use* and, crucially, *when NOT to use* a particular tool or pattern.

## Content Security Policy (CSP)
*   **What it is**: A security standard (via HTTP headers) that acts as a strict allowlist for approved sources of content the browser may load.
*   **Why we used it / How it helps**: We store the LLM API Key in `localStorage`. If an attacker executes a malicious script (XSS), they could read it and exfiltrate it. By setting the `connect-src` directive to only allow connections to our trusted backends (Salesforce, OpenRouter, Hugging Face), the browser actively blocks network requests to attacker domains.
*   **✅ When to reach for it**: 
    - Always, on user-facing web applications. It's a default security baseline.
    - When your application ingests and renders user-generated content.
*   **❌ When NOT to use it (Trade-offs)**: 
    - When migrating a massive legacy application with thousands of inline scripts. Don't turn it on in `enforce` mode immediately; it will break the site. Use `Content-Security-Policy-Report-Only` first.
    - Simple static sites with no user input (ROI is lower).
*   **Implementation**: We used the `nuxt-security` module in Nuxt 4, which hooks into the Nitro server engine to automatically append these security headers to every response.

## Static Analysis & Typechecking (`eslint` & `vue-tsc`)
*   **What it is**: Tools that analyze your code *without running it* to catch logic errors, enforce coding styles, and ensure data types perfectly match.
*   **Why we used it / How it helps**: In a TypeScript project, Nuxt's builder (`esbuild`) drops types for maximum speed, meaning fatal type errors aren't caught during build. `vue-tsc` acts as a hard safety net, while `eslint` acts as an automated strict code reviewer preventing logical anti-patterns.
*   **✅ When to reach for it**:
    - Any production JavaScript/TypeScript project.
    - When working in a team to enforce a consistent code style.
    - When building large-scale applications where refactoring without types is dangerous.
*   **❌ When NOT to use it (Trade-offs)**:
    - **Quick throwaway prototypes / scratch scripts**: Setting up strict TS/ESLint rules can slow down rapid experimentation.
    - **Overly strict configurations**: Using excessively pedantic linting rules can cause developer fatigue and block builds for trivial stylistic reasons rather than actual bugs.
*   **Implementation**: Installed the `@nuxt/eslint` module for integrated stylistic checks and added `npm run typecheck` & `npm run lint` to our `package.json` scripts for manual and automated validation.
