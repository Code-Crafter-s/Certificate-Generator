// For Vercel deployment, use relative URLs for same-domain API calls
// For local development, use the environment variable
const isProduction = import.meta.env.PROD;
const rawBaseUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';
const API_BASE_URL = isProduction ? '' : rawBaseUrl.replace(/\/?api(?:\/health)?$/i, '');

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Debug logging
    console.log(`Making API request to: ${url}`);
    console.log(`Base URL: ${this.baseURL}, Endpoint: ${endpoint}`);

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      console.error(`Full URL: ${url}`);
      throw error;
    }
  }

  // Participants API
  async getParticipants() {
    return this.request('/api/participants');
  }

  async createParticipant(participant) {
    return this.request('/api/participants', {
      method: 'POST',
      body: JSON.stringify(participant),
    });
  }

  async updateParticipant(id, participant) {
    return this.request(`/api/participants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(participant),
    });
  }

  async deleteParticipant(id) {
    return this.request(`/api/participants/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkImportParticipants(participants) {
    return this.request('/api/participants/bulk', {
      method: 'POST',
      body: JSON.stringify({ participants }),
    });
  }

  // Settings API
  async getSettings() {
    return this.request('/api/settings');
  }

  async updateSettings(settings) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Email API
  async sendBulkEmails(participantIds, emailData = {}) {
    return this.request('/api/send-bulk', {
      method: 'POST',
      body: JSON.stringify({
        participantIds,
        ...emailData,
      }),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/api/health');
  }
}

export default new ApiService();
