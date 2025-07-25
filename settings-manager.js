class SettingsManager {
  constructor() {
    this.settings = {};
    this.init();
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.on("tab:changed", (tab) => {
      if (tab === "settings") {
        this.renderSettings();
      }
    });

    eventBus.on("project:loaded", (projectData) => {
      this.loadProjectSettings(projectData);
    });
  }

  async init() {
    this.settings = {
      starterPrompt: "Build me a basic web app for react, vite, supabase app.",
      appendPrompt: "",
      waitTime: 120000,
    };

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
      if (
        window.projectManager &&
        window.projectManager.currentProject &&
        window.projectManager.projectData
      ) {
        window.projectManager.projectData.settings = { ...this.settings };
        window.projectManager.saveProjectData();
      } else {
        await StorageManager.set("app_settings", this.settings);
      }
      this.showSaveSuccess();
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showSaveError();
    }
  }

  loadProjectSettings(projectData) {
    if (projectData && projectData.settings) {
      this.settings = {
        ...this.settings,
        ...projectData.settings,
      };
    } else {
      this.settings = {
        starterPrompt:
          "Build me a basic web app for react, vite, supabase app.",
        appendPrompt: "",
        waitTime: 120000,
      };

      if (projectData && window.projectManager) {
        projectData.settings = { ...this.settings };
        window.projectManager.saveProjectData();
      }
    }
    this.updateUI();
  }

  updateUI() {
    const starterPromptInput = document.getElementById("starterPromptInput");
    const appendPromptInput = document.getElementById("appendPromptInput");

    if (starterPromptInput) {
      starterPromptInput.value = this.settings.starterPrompt || "";
    }

    if (appendPromptInput) {
      appendPromptInput.value = this.settings.appendPrompt || "";
    }
  }

  showSaveSuccess() {
    const saveBtn = document.getElementById("saveSettingsBtn");
    if (!saveBtn) return;

    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saved!";
    saveBtn.style.background = "#00b894";

    setTimeout(() => {
      saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17,21 17,13 7,13 7,21"></polyline>
          <polyline points="7,3 7,8 15,8"></polyline>
        </svg>
        Save Settings
      `;
      saveBtn.style.background = "#00d4aa";
    }, 2000);
  }

  showSaveError() {
    const saveBtn = document.getElementById("saveSettingsBtn");
    if (!saveBtn) return;

    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Error!";
    saveBtn.style.background = "#ff4757";

    setTimeout(() => {
      saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17,21 17,13 7,13 7,21"></polyline>
          <polyline points="7,3 7,8 15,8"></polyline>
        </svg>
        Save Settings
      `;
      saveBtn.style.background = "#00d4aa";
    }, 2000);
  }

  debouncedSave = CoreUtils.debounce(() => {
    this.saveSettings();
  }, 1000);

  getSettings() {
    if (
      window.projectManager &&
      window.projectManager.projectData &&
      window.projectManager.projectData.settings
    ) {
      return { ...window.projectManager.projectData.settings };
    }
    return { ...this.settings };
  }

  getStarterPrompt() {
    return (
      this.settings.starterPrompt ||
      "Build me a basic web app for react, vite, supabase app."
    );
  }

  getAppendPrompt() {
    return this.settings.appendPrompt || "";
  }

  getWaitTime() {
    return this.settings.waitTime || 120000;
  }

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

  async refreshSettings() {
    await this.loadSettings();
  }

  renderSettings() {
    const settingsContent = document.getElementById("settingsContent");
    if (!settingsContent) return;

    const currentProjectTitle =
      window.projectManager && window.projectManager.projectData
        ? window.projectManager.projectData.title || ""
        : "";

    const hasCurrentProject =
      window.projectManager && window.projectManager.currentProject;

    settingsContent.innerHTML = `
      <div class="settings-container">
        ${
          hasCurrentProject
            ? `
        <div class="setting-group">
          <h3>Project Title</h3>
          <p class="setting-description">Change the title of the current project. This will be displayed in the project list.</p>
          <input 
            type="text"
            id="projectTitleInput" 
            placeholder="My Awesome App"
            value="${CoreUtils.escapeHtml(currentProjectTitle)}"
          />
        </div>
        `
            : ""
        }

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

    const saveBtn = document.getElementById("saveSettingsBtn");
    const projectTitleInput = document.getElementById("projectTitleInput");
    const starterPromptInput = document.getElementById("starterPromptInput");
    const appendPromptInput = document.getElementById("appendPromptInput");
    const waitTimeSelect = document.getElementById("waitTimeSelect");

    saveBtn.addEventListener("click", () => {
      if (
        projectTitleInput &&
        window.projectManager &&
        window.projectManager.projectData
      ) {
        const newTitle = projectTitleInput.value.trim();
        if (newTitle && newTitle !== window.projectManager.projectData.title) {
          window.projectManager.projectData.title = newTitle;
          window.projectManager.saveProjectData();

          if (window.uiManager) {
            window.uiManager.updateProjectHeader(
              window.projectManager.projectData
            );
          }
        }
      }

      this.settings.starterPrompt = starterPromptInput.value;
      this.settings.appendPrompt = appendPromptInput.value;
      this.settings.waitTime = parseInt(waitTimeSelect.value);
      this.saveSettings();
      this.showSaveConfirmation();
    });

    const settingsInputs = [
      starterPromptInput,
      appendPromptInput,
      waitTimeSelect,
    ].filter(Boolean);
    settingsInputs.forEach((input) => {
      input.addEventListener("change", () => {
        this.settings.starterPrompt = starterPromptInput.value;
        this.settings.appendPrompt = appendPromptInput.value;
        this.settings.waitTime = parseInt(waitTimeSelect.value);
        this.saveSettings();
      });
    });

    if (projectTitleInput) {
      projectTitleInput.addEventListener("change", () => {
        const newTitle = projectTitleInput.value.trim();
        if (
          newTitle &&
          window.projectManager &&
          window.projectManager.projectData
        ) {
          if (newTitle !== window.projectManager.projectData.title) {
            window.projectManager.projectData.title = newTitle;
            window.projectManager.saveProjectData();

            if (window.uiManager) {
              window.uiManager.updateProjectHeader(
                window.projectManager.projectData
              );
            }
          }
        }
      });
    }
  }
}

window.SettingsManager = SettingsManager;
