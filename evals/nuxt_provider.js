const { execSync } = require('child_process');

class NuxtBFFProvider {
  constructor(options) {
    this.providerId = options.id || 'nuxt-bff';
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt) {
    const body = {
      messages: [{ role: 'user', content: prompt }]
    };

    try {
      // 1. Automatically fetch the Salesforce Token via CLI (The CI/CD Service Account pattern)
      const sfOutput = execSync('sf org display --target-org vscodeOrg --json', { encoding: 'utf-8' });
      const sfData = JSON.parse(sfOutput);
      const accessToken = sfData.result.accessToken;
      const instanceUrl = sfData.result.instanceUrl;

      // 2. Pass it to the Nuxt BFF using our new test-mode override headers
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sf-access-token': accessToken,
          'x-sf-instance-url': instanceUrl
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Nuxt API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        output: data.reply,
      };
    } catch (err) {
      return {
        error: `API call error: ${String(err)}`,
      };
    }
  }
}

module.exports = NuxtBFFProvider;
