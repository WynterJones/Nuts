// Core utilities and helpers
class CoreUtils {
  static escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  static formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  static formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(data));
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    }
  }
}

class StorageManager {
  static async get(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch (error) {
      console.error("Storage get error:", error);
      return null;
    }
  }

  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error("Storage set error:", error);
      return false;
    }
  }

  static async getAll() {
    try {
      return await chrome.storage.local.get(null);
    } catch (error) {
      console.error("Storage getAll error:", error);
      return {};
    }
  }

  static async remove(key) {
    try {
      await chrome.storage.local.remove([key]);
      return true;
    } catch (error) {
      console.error("Storage remove error:", error);
      return false;
    }
  }
}

window.eventBus = new EventBus();

window.CoreUtils = CoreUtils;
window.StorageManager = StorageManager;
