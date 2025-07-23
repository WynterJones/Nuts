class PopupManager {
  constructor() {
    this.apiKeyInput = document.getElementById("apiKey");
    this.modelSelect = document.getElementById("model");
    this.saveBtn = document.getElementById("saveBtn");
    this.testBtn = document.getElementById("testBtn");
    this.status = document.getElementById("status");

    this.init();
  }

  async init() {
    await this.loadSavedConfig();
    this.setupEventListeners();
  }

  async loadSavedConfig() {
    const result = await chrome.storage.local.get([
      "openai_api_key",
      "openai_model",
    ]);

    if (result.openai_api_key) {
      this.apiKeyInput.value = result.openai_api_key;
    }

    if (result.openai_model) {
      this.modelSelect.value = result.openai_model;
    } else {
      this.modelSelect.value = "gpt-4o-mini";
    }
  }

  setupEventListeners() {
    this.saveBtn.addEventListener("click", () => this.saveConfig());
    this.testBtn.addEventListener("click", () => this.testConnection());

    this.apiKeyInput.addEventListener("input", () => {
      this.hideStatus();
    });
  }

  async saveConfig() {
    const apiKey = this.apiKeyInput.value.trim();
    const model = this.modelSelect.value;

    if (!apiKey) {
      this.showStatus("Please enter your OpenAI API key", "error");
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      this.showStatus("Invalid API key format", "error");
      return;
    }

    try {
      await chrome.storage.local.set({
        openai_api_key: apiKey,
        openai_model: model,
      });

      this.showStatus("Configuration saved successfully!", "success");
    } catch (error) {
      this.showStatus("Failed to save configuration", "error");
    }
  }

  async testConnection() {
    const apiKey = this.apiKeyInput.value.trim();
    const model = this.modelSelect.value;

    if (!apiKey) {
      this.showStatus("Please enter your API key first", "error");
      return;
    }

    this.showStatus("Testing connection...", "loading");

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        this.showStatus("Connection successful! ✅", "success");
      } else {
        const error = await response.json();
        this.showStatus(
          `Connection failed: ${error.error?.message || "Unknown error"}`,
          "error"
        );
      }
    } catch (error) {
      this.showStatus("Network error. Please check your connection.", "error");
    }
  }

  showStatus(message, type) {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
    this.status.style.display = "block";

    if (type === "success") {
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  hideStatus() {
    this.status.style.display = "none";
    this.status.className = "status";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
