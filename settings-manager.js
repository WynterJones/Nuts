// Settings Manager - handles application settings
class SettingsManager {
  constructor() {
    this.settings = {
      starterPrompt: "What kind of frameworks can you use?",
      appendPrompt: "",
    };

    this.initElements();
    this.setupEventListeners();
    this.loadSettings();
  }

  initElements() {
    this.starterPromptTextarea = document.getElementById("starterPrompt");
    this.appendPromptTextarea = document.getElementById("appendPrompt");
    this.saveSettingsBtn = document.getElementById("saveSettingsBtn");
  }

  setupEventListeners() {
    this.saveSettingsBtn.addEventListener("click", () => this.saveSettings());

    // Auto-save on input change
    this.starterPromptTextarea.addEventListener("input", () => {
      this.settings.starterPrompt = this.starterPromptTextarea.value;
      this.debouncedSave();
    });

    this.appendPromptTextarea.addEventListener("input", () => {
      this.settings.appendPrompt = this.appendPromptTextarea.value;
      this.debouncedSave();
    });

    // Listen for tab changes to ensure settings are updated
    eventBus.on("tab:changed", (tab) => {
      if (tab === "settings") {
        this.loadSettings();
      }
    });
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
      this.settings.starterPrompt || "What kind of frameworks can you use?"
    );
  }

  // Get append prompt for tasks
  getAppendPrompt() {
    return this.settings.appendPrompt || "";
  }

  // Refresh settings from storage (useful when AI generates new starter prompt)
  async refreshSettings() {
    await this.loadSettings();
  }
}

// Make SettingsManager globally available
window.SettingsManager = SettingsManager;
