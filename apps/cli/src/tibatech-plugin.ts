export interface NexusCoreConfig {
  baseUrl: string;
  apiKey?: string;
}

export class TibaTechPlugin {
  private config: NexusCoreConfig;
  public name = 'tibatech-integration';

  constructor(config?: NexusCoreConfig) {
    // المنفذ 4141 مستخرج من وثيقة ARCHITECTURE.md الخاصة بـ nexus-core
    this.config = config || { baseUrl: 'http://127.0.0.1:4141' };
  }

  async sendPrompt(sessionId: string, prompt: string) {
    console.log(`[TibaTech] Routing prompt to Nexus-Core at ${this.config.baseUrl}/session`);
    
    try {
      const response = await fetch(`${this.config.baseUrl}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify({
          sessionId,
          messages: [{ role: 'user', content: prompt }]
        })
      });

        throw new Error(`Nexus-Core responded with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[TibaTech] Failed to communicate with Nexus-Core:', error);
      throw error;
    }
  }
}