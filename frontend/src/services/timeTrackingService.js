class TimeTrackingService {
  constructor() {
    this.baseURL = 'http://localhost:3001/api'; // Direct backend URL
  }

  // Get authentication headers
  getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Get all time entries
  async getAllEntries() {
    try {
      const response = await fetch(`${this.baseURL}/time-entries`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching time entries:', error);
      throw error;
    }
  }

  // Get active time entries
  async getActiveEntries() {
    try {
      const response = await fetch(`${this.baseURL}/time-entries/active`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching active time entries:', error);
      throw error;
    }
  }

  // Create new time entry
  async createEntry(entryData) {
    try {
      const response = await fetch(`${this.baseURL}/time-entries`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(entryData),
      });
      if (!response.ok) {
        // Try to get the actual error message from the response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating time entry:', error);
      throw error;
    }
  }

  // Stop time entry
  async stopEntry(entryId) {
    try {
      const response = await fetch(`${this.baseURL}/time-entries/${entryId}/stop`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error stopping time entry:', error);
      throw error;
    }
  }

  // Update time entry
  async updateEntry(entryId, updates) {
    try {
      const response = await fetch(`${this.baseURL}/time-entries/${entryId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating time entry:', error);
      throw error;
    }
  }

  // Delete time entry
  async deleteEntry(entryId) {
    try {
      const response = await fetch(`${this.baseURL}/time-entries/${entryId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting time entry:', error);
      throw error;
    }
  }
}

const timeTrackingService = new TimeTrackingService();
export default timeTrackingService;

