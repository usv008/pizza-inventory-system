/**
 * Robust API Helper Functions
 * Handles timeouts, retries, and error recovery
 */

class ApiHelper {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.defaultTimeout = options.timeout || 10000; // 10 seconds
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
    }

    /**
     * Robust fetch with timeout and retry logic
     */
    async robustFetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
        
        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        };

        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🌐 API Request (attempt ${attempt}/${this.maxRetries}): ${url}`);
                
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                console.log(`✅ API Success: ${url}`);
                return response;
                
            } catch (error) {
                lastError = error;
                console.error(`❌ API Error (attempt ${attempt}/${this.maxRetries}):`, error.message);
                
                // Don't retry on abort (timeout) if it's the last attempt
                if (attempt === this.maxRetries) {
                    break;
                }
                
                // Wait before retry
                await this.delay(this.retryDelay * attempt);
                
                // Create new controller for next attempt
                if (controller.signal.aborted) {
                    const newController = new AbortController();
                    fetchOptions.signal = newController.signal;
                    clearTimeout(timeoutId);
                    setTimeout(() => newController.abort(), this.defaultTimeout);
                }
            }
        }
        
        clearTimeout(timeoutId);
        throw new Error(`API request failed after ${this.maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * GET request with retry logic
     */
    async get(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await this.robustFetch(url, { method: 'GET' });
        return response.json();
    }

    /**
     * POST request with retry logic
     */
    async post(endpoint, data) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await this.robustFetch(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response.json();
    }

    /**
     * PUT request with retry logic
     */
    async put(endpoint, data) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await this.robustFetch(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return response.json();
    }

    /**
     * DELETE request with retry logic
     */
    async delete(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await this.robustFetch(url, { method: 'DELETE' });
        return response.json();
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create global API helper instance
window.apiHelper = new ApiHelper('http://116.203.116.234:3000/api', {
    timeout: 15000,  // 15 seconds timeout
    maxRetries: 3,   // 3 attempts
    retryDelay: 2000 // 2 seconds between retries
});

// Legacy support - wrap existing fetch calls
window.robustApiCall = async function(url, options = {}) {
    try {
        return await window.apiHelper.robustFetch(url, options);
    } catch (error) {
        console.error('🚨 Robust API call failed:', error);
        throw error;
    }
};

console.log('✅ API Helper loaded with robust retry logic'); 