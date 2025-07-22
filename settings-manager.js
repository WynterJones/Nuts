// Settings Manager - handles application settings
class SettingsManager {
  constructor() {
    this.settings = {};
    this.init();
    this.setupEventListeners();
  }

  initElements() {
    this.starterPromptTextarea = document.getElementById("starterPrompt");
    this.appendPromptTextarea = document.getElementById("appendPrompt");
    this.saveSettingsBtn = document.getElementById("saveSettingsBtn");
  }

  setupEventListeners() {
    // Listen for tab changes to render settings when settings tab is active
    eventBus.on("tab:changed", (tab) => {
      if (tab === "settings") {
        this.renderSettings();
      }
    });
  }

  async init() {
    // Set default settings
    this.settings = {
      starterPrompt: "Build me a basic web app for react, vite, supabase app.",
      appendPrompt: "",
      waitTime: 60000, // Default wait time in milliseconds (1 minute)
    };

    // Load settings from storage
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const savedSettings = await StorageManager.get("app_settings");
      if (savedSettings) {
        this.settings = { ...this.settings, ...savedSettings };
      }
      this.updateUI();
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async saveSettings() {
    try {
      await StorageManager.set("app_settings", this.settings);
      console.log("Settings saved:", this.settings);
      this.showSaveSuccess();
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showSaveError();
    }
  }

  updateUI() {
    this.starterPromptTextarea.value = this.settings.starterPrompt;
    this.appendPromptTextarea.value = this.settings.appendPrompt;
  }

  showSaveSuccess() {
    const originalText = this.saveSettingsBtn.textContent;
    this.saveSettingsBtn.textContent = "Saved!";
    this.saveSettingsBtn.style.background = "#00b894";

    setTimeout(() => {
      this.saveSettingsBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17,21 17,13 7,13 7,21"></polyline>
          <polyline points="7,3 7,8 15,8"></polyline>
        </svg>
        Save Settings
      `;
      this.saveSettingsBtn.style.background = "#00d4aa";
    }, 2000);
  }

  showSaveError() {
    const originalText = this.saveSettingsBtn.textContent;
    this.saveSettingsBtn.textContent = "Error!";
    this.saveSettingsBtn.style.background = "#ff4757";

    setTimeout(() => {
      this.saveSettingsBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17,21 17,13 7,13 7,21"></polyline>
          <polyline points="7,3 7,8 15,8"></polyline>
        </svg>
        Save Settings
      `;
      this.saveSettingsBtn.style.background = "#00d4aa";
    }, 2000);
  }

  // Debounced save function
  debouncedSave = CoreUtils.debounce(() => {
    this.saveSettings();
  }, 1000);

  // Get current settings
  getSettings() {
    return this.settings;
  }

  // Get starter prompt for automation
  getStarterPrompt() {
    return (
      this.settings.starterPrompt ||
      "Build me a basic web app for react, vite, supabase app."
    );
  }

  // Get append prompt for tasks
  getAppendPrompt() {
    return this.settings.appendPrompt || "";
  }

  // Get wait time in milliseconds
  getWaitTime() {
    return this.settings.waitTime || 60000;
  }

  // Show save confirmation
  showSaveConfirmation() {
    const saveBtn = document.getElementById("saveSettingsBtn");
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saved!";
      saveBtn.style.background = "#00d4aa";
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
      }, 1500);
    }
  }

  // Refresh settings from storage (useful when AI generates new starter prompt)
  async refreshSettings() {
    await this.loadSettings();
  }

  renderSettings() {
    const settingsContent = document.getElementById("settingsContent");
    if (!settingsContent) return;

    settingsContent.innerHTML = `
      <div class="settings-container">
        <div class="setting-group">
          <h3>Starter Prompt</h3>
          <p class="setting-description">This prompt is used when starting a new project from the root domain (bolt.new). It helps initialize the project.</p>
          <textarea 
            id="starterPromptInput" 
            placeholder="Build me a basic web app for react, vite, supabase app."
            rows="4"
          >${this.settings.starterPrompt || ""}</textarea>
        </div>

        <div class="setting-group">
          <h3>Append Prompt</h3>
          <p class="setting-description">This text will be appended to each task when sent to Bolt. Use it for consistent instructions across all tasks.</p>
          <textarea 
            id="appendPromptInput" 
            placeholder="Keep files small, make and use reusable components"
            rows="3"
          >${this.settings.appendPrompt || ""}</textarea>
        </div>

        <div class="setting-group">
          <h3>Wait Time</h3>
          <p class="setting-description">How long to wait for Bolt to process each task before continuing to the next one.</p>
          <select id="waitTimeSelect">
            <option value="60000" ${
              this.settings.waitTime === 60000 ? "selected" : ""
            }>1 minute</option>
            <option value="120000" ${
              this.settings.waitTime === 120000 ? "selected" : ""
            }>2 minutes</option>
            <option value="300000" ${
              this.settings.waitTime === 300000 ? "selected" : ""
            }>5 minutes</option>
            <option value="-1" ${
              this.settings.waitTime === -1 ? "selected" : ""
            }>Forever (manual)</option>
          </select>
        </div>

        <div class="settings-actions">
          <button id="saveSettingsBtn" class="save-btn">Save Settings</button>
        </div>
      </div>
    `;

    // Setup event listeners
    const saveBtn = document.getElementById("saveSettingsBtn");
    const starterPromptInput = document.getElementById("starterPromptInput");
    const appendPromptInput = document.getElementById("appendPromptInput");
    const waitTimeSelect = document.getElementById("waitTimeSelect");

    saveBtn.addEventListener("click", () => {
      this.settings.starterPrompt = starterPromptInput.value;
      this.settings.appendPrompt = appendPromptInput.value;
      this.settings.waitTime = parseInt(waitTimeSelect.value);
      this.saveSettings();
      this.showSaveConfirmation();
    });

    // Auto-save on input changes
    [starterPromptInput, appendPromptInput, waitTimeSelect].forEach((input) => {
      input.addEventListener("change", () => {
        this.settings.starterPrompt = starterPromptInput.value;
        this.settings.appendPrompt = appendPromptInput.value;
        this.settings.waitTime = parseInt(waitTimeSelect.value);
        this.saveSettings();
      });
    });
  }
}

// Make SettingsManager globally available
window.SettingsManager = SettingsManager;
