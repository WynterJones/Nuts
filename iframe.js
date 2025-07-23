class IframeApp {
  constructor() {
    this.checkApiKeyAndInitialize();
  }

  async checkApiKeyAndInitialize() {
    try {
      const apiKey = await StorageManager.get("openai_api_key");

      if (!apiKey) {
        await this.showApiKeyGate();
      } else {
        this.initializeApp();
      }
    } catch (error) {
      console.error("Error checking API key:", error);
      await this.showApiKeyGate();
    }
  }

  async showApiKeyGate() {
    const appContainer = document.querySelector(".assistant-container");

    if (appContainer) {
      const existingModel =
        (await StorageManager.get("openai_model")) || "gpt-4o-mini";

      appContainer.innerHTML = `
        <div class="api-key-gate">
          <div class="api-key-gate-content">
            <div class="gate-header">
              <img id="gateIcon" alt="Nuts for Bolt" class="gate-icon">
              <h2>Welcome to Nuts for Bolt</h2>
              <p>Please add your OpenAI API key</p>
            </div>
            
            <div class="gate-form">
              <div class="form-group">
                <label for="gateApiKey">OpenAI API Key</label>
                <input 
                  type="password" 
                  id="gateApiKey" 
                  placeholder="sk-..." 
                  class="gate-input"
                />
                <div class="gate-input-note">
                  Your API key is stored locally and never shared
                </div>
              </div>
              
              <div class="form-group">
                <label for="gateModel">Model</label>
                <select id="gateModel" class="gate-select">
                  <option value="gpt-4o-mini" ${
                    existingModel === "gpt-4o-mini" ? "selected" : ""
                  }>GPT-4o Mini (Recommended)</option>
                  <option value="gpt-4o" ${
                    existingModel === "gpt-4o" ? "selected" : ""
                  }>GPT-4o</option>
                  <option value="gpt-4-turbo" ${
                    existingModel === "gpt-4-turbo" ? "selected" : ""
                  }>GPT-4 Turbo</option>
                </select>
              </div>
              
              <div class="gate-buttons">
                <button id="gateTestBtn" class="gate-test-btn">Test Connection</button>
                <button id="gateSaveBtn" class="gate-save-btn">Activate Assistant</button>
              </div>
              
              <div id="gateStatus" class="gate-status"></div>
            </div>
            
            <div class="gate-footer">
              <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a></p>
            </div>
          </div>
        </div>
      `;

      const gateIcon = document.getElementById("gateIcon");
      if (gateIcon) {
        gateIcon.src = chrome.runtime.getURL("icon/128.png");
      }

      this.setupGateEventListeners();
    }
  }

  setupGateEventListeners() {
    const apiKeyInput = document.getElementById("gateApiKey");
    const modelSelect = document.getElementById("gateModel");
    const testBtn = document.getElementById("gateTestBtn");
    const saveBtn = document.getElementById("gateSaveBtn");
    const statusDiv = document.getElementById("gateStatus");

    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        await this.testConnection(
          apiKeyInput.value.trim(),
          modelSelect.value,
          statusDiv
        );
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        await this.saveApiKey(
          apiKeyInput.value.trim(),
          modelSelect.value,
          statusDiv
        );
      });
    }

    if (apiKeyInput) {
      apiKeyInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          saveBtn.click();
        }
      });
    }
  }

  async testConnection(apiKey, model, statusDiv) {
    if (!apiKey) {
      this.showGateStatus(
        "Please enter your API key first",
        "error",
        statusDiv
      );
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      this.showGateStatus("Invalid API key format", "error", statusDiv);
      return;
    }

    this.showGateStatus("Testing connection...", "loading", statusDiv);

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        this.showGateStatus("Connection successful! ✅", "success", statusDiv);
      } else {
        const error = await response.json();
        this.showGateStatus(
          `Connection failed: ${error.error?.message || "Unknown error"}`,
          "error",
          statusDiv
        );
      }
    } catch (error) {
      this.showGateStatus(
        "Network error. Please check your connection.",
        "error",
        statusDiv
      );
    }
  }

  async saveApiKey(apiKey, model, statusDiv) {
    if (!apiKey) {
      this.showGateStatus("Please enter your API key", "error", statusDiv);
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      this.showGateStatus("Invalid API key format", "error", statusDiv);
      return;
    }

    try {
      const success = await StorageManager.set("openai_api_key", apiKey);
      await StorageManager.set("openai_model", model);

      if (success) {
        this.showGateStatus(
          "API key saved! Initializing assistant...",
          "success",
          statusDiv
        );

        setTimeout(() => {
          this.initializeApp();
        }, 1500);
      } else {
        this.showGateStatus("Failed to save API key", "error", statusDiv);
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      this.showGateStatus("Failed to save API key", "error", statusDiv);
    }
  }

  showGateStatus(message, type, statusDiv) {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `gate-status ${type}`;
    }
  }

  initializeApp() {
    this.loadProjectIcon();

    const appContainer = document.querySelector(".assistant-container");
    if (appContainer && appContainer.innerHTML.includes("api-key-gate")) {
      window.location.reload();
      return;
    }

    window.uiManager = new UIManager();
    window.projectManager = new ProjectManager();
    window.chatManager = new ChatManager();
    window.automationManager = new AutomationManager();
    window.settingsManager = new SettingsManager();

    window.projectManager.loadAllProjects();

    console.log("Nuts for Bolt iframe initialized");
  }

  loadProjectIcon() {
    const iconElement = document.getElementById("projectIcon");
    if (iconElement) {
      iconElement.src = chrome.runtime.getURL("icon/128.png");
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new IframeApp();
  });
} else {
  new IframeApp();
}
