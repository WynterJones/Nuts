class AutomationManager {
  constructor() {
    this.isRunning = false;
    this.currentTaskIndex = 0;
    this.tasks = [];
    this.settings = {
      autoSupabaseMigration: false,
      autoErrorFix: false,
      autoContinue: true,
    };

    this.initElements();
    this.setupEventListeners();
    this.loadSettings();
    this.checkUrlAndUpdateUI();

    setTimeout(() => {
      this.updateAutomationDescription();
    }, 100);
  }

  initElements() {
    this.autoSupabaseMigrationToggle = document.getElementById(
      "autoSupabaseMigration"
    );
    this.autoErrorFixToggle = document.getElementById("autoErrorFix");
    this.autoContinueToggle = document.getElementById("autoContinue");
    this.runAutomationBtn = document.getElementById("runAutomationBtn");
    this.stopAutomationBtn = document.getElementById("stopAutomationBtn");
    this.automationProgress = document.getElementById("automationProgress");
    this.automationStatusText = document.getElementById("automationStatusText");
  }

  setupEventListeners() {
    this.autoSupabaseMigrationToggle.addEventListener("change", (e) => {
      this.settings.autoSupabaseMigration = e.target.checked;
      this.saveSettings();
      this.updateAutomationDescription();
    });

    this.autoErrorFixToggle.addEventListener("change", (e) => {
      this.settings.autoErrorFix = e.target.checked;
      this.saveSettings();
      this.updateAutomationDescription();
    });

    this.autoContinueToggle.addEventListener("change", (e) => {
      this.settings.autoContinue = e.target.checked;
      this.saveSettings();
      this.updateAutomationDescription();
    });

    this.runAutomationBtn.addEventListener("click", () =>
      this.startAutomation()
    );
    this.stopAutomationBtn.addEventListener("click", () =>
      this.stopAutomation()
    );

    eventBus.on("project:loaded", (projectData) => {
      this.tasks = projectData.todos || [];
    });

    eventBus.on("tasks:updated", (todos) => {
      this.tasks = todos || [];
    });

    eventBus.on("tab:changed", (tab) => {
      if (tab === "automation") {
        this.refreshTasks();
        this.checkUrlAndUpdateUI();

        setTimeout(() => {
          this.updateAutomationDescription();
        }, 50);
      }
    });

    window.addEventListener("message", (event) => {
      if (event.data.type === "AUTOMATION_STEP_COMPLETE") {
        this.handleStepComplete(event.data);
      } else if (event.data.type === "AUTOMATION_ERROR") {
        this.handleAutomationError(event.data);
      } else if (event.data.type === "AUTOMATION_STATUS_UPDATE") {
        this.updateStatus(event.data.status);
      }
    });
  }

  async loadSettings() {
    try {
      const savedSettings = await StorageManager.get("automation_settings");
      if (savedSettings) {
        this.settings = { ...this.settings, ...savedSettings };
        this.updateToggleStates();
      }
      this.updateAutomationDescription();
    } catch (error) {
      console.error("Error loading automation settings:", error);
    }
  }

  async saveSettings() {
    try {
      await StorageManager.set("automation_settings", this.settings);
    } catch (error) {
      console.error("Error saving automation settings:", error);
    }
  }

  updateToggleStates() {
    this.autoSupabaseMigrationToggle.checked =
      this.settings.autoSupabaseMigration;
    this.autoErrorFixToggle.checked = this.settings.autoErrorFix;
    this.autoContinueToggle.checked = this.settings.autoContinue;
  }

  async startAutomation() {
    if (this.isRunning) return;

    this.refreshTasks();

    this.isRunning = true;
    this.currentTaskIndex = 0;

    document.body.classList.add("automation-running");

    this.runAutomationBtn.classList.add("hidden");
    this.stopAutomationBtn.classList.remove("hidden");
    this.automationProgress.classList.remove("hidden");
    this.updateStatus("Initializing...");

    try {
      const currentUrl = await this.getCurrentUrl();

      if (
        currentUrl === "https://bolt.new" ||
        currentUrl === "https://bolt.new/"
      ) {
        await this.runStartingSequence();
      } else if (currentUrl.includes("bolt.new/~/")) {
        await this.runTaskSequence();
      } else {
        throw new Error(
          "Automation can only run on bolt.new project URLs (bolt.new/~/.*)"
        );
      }
    } catch (error) {
      console.error("Automation error:", error);
      this.handleAutomationError({ error: error.message });
    }
  }

  async getCurrentUrl() {
    return new Promise((resolve) => {
      window.parent.postMessage(
        {
          type: "GET_CURRENT_URL",
        },
        "*"
      );

      const handleUrlResponse = (event) => {
        if (event.data.type === "CURRENT_URL_RESPONSE") {
          window.removeEventListener("message", handleUrlResponse);
          resolve(event.data.url);
        }
      };

      window.addEventListener("message", handleUrlResponse);
    });
  }

  async checkUrlAndUpdateUI() {
    try {
      const currentUrl = await this.getCurrentUrl();

      const isRootDomain =
        currentUrl === "https://bolt.new" || currentUrl === "https://bolt.new/";

      const isProjectUrl = currentUrl.includes("bolt.new/~/");

      if (isRootDomain) {
        this.showStartingPromptMessage();
      } else if (isProjectUrl) {
        this.showNormalAutomationUI();
      } else {
        this.showUnsupportedUrlMessage();
      }

      this.updateAutomationDescription();
    } catch (error) {
      console.error("Error checking URL:", error);
      this.showNormalAutomationUI();
      this.updateAutomationDescription();
    }
  }

  refreshTasks() {
    if (window.projectManager && window.projectManager.projectData) {
      const currentTasks = window.projectManager.projectData.todos || [];
      this.tasks = [...currentTasks];

      const incompleteTasks = this.getSortedTasks().filter((t) => !t.completed);
      const completedTasks = this.getSortedTasks().filter((t) => t.completed);

      if (this.automationStatusText && !this.isRunning) {
        this.updateStatus(
          `Ready - ${incompleteTasks.length} pending, ${completedTasks.length} completed`
        );
      }

      this.updateAutomationDescription();
    } else if (this.automationStatusText && !this.isRunning) {
      this.updateStatus("No project loaded");
      this.updateAutomationDescription();
    }
  }

  updateAutomationDescription() {
    const descriptionElement = document.getElementById("automationDescription");
    if (!descriptionElement) {
      return;
    }

    if (!this.tasks || this.tasks.length === 0) {
      if (window.projectManager && window.projectManager.currentProject) {
        descriptionElement.textContent =
          "No tasks available. Add tasks to enable automation.";
      } else {
        descriptionElement.textContent =
          "No project loaded. Select a project to view automation options.";
      }
      return;
    }

    const sortedTasks = this.getSortedTasks();
    const activeTasks = sortedTasks.filter((t) => !t.completed).length;
    const totalTasks = sortedTasks.length;

    if (totalTasks === 0) {
      descriptionElement.textContent =
        "No tasks available. Add tasks to enable automation.";
      return;
    }

    if (activeTasks === 0) {
      descriptionElement.textContent = `All ${totalTasks} tasks completed. Nothing to automate.`;
      return;
    }

    let description = `The automator will run ${activeTasks} active task${
      activeTasks !== 1 ? "s" : ""
    } (of ${totalTasks}) and will paste each task into the prompt box`;

    if (this.settings.autoContinue) {
      description += ", auto-continue to the next task";
    } else {
      description += ", wait for manual continue";
    }

    if (this.settings.autoSupabaseMigration) {
      description += ", auto-run Supabase migrations";
    } else {
      description += ", stop if Supabase migrations are detected";
    }

    if (this.settings.autoErrorFix) {
      description += ", and attempt to fix errors automatically";
    } else {
      description += ", and stop if errors are detected";
    }

    description += ".";

    descriptionElement.textContent = description;
  }

  showStartingPromptMessage() {
    if (!this.runAutomationBtn) return;

    this.runAutomationBtn.disabled = true;
    this.runAutomationBtn.classList.add("disabled");

    const settingsGroup = document.querySelector(".setting-group");
    if (settingsGroup) {
      settingsGroup.style.display = "none";
    }

    let messageDiv = document.getElementById("startingPromptMessage");
    if (!messageDiv) {
      messageDiv = document.createElement("div");
      messageDiv.id = "startingPromptMessage";
      messageDiv.className = "automation-message";
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="message-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v8"></path>
              <path d="m8 12 4 4 4-4"></path>
            </svg>
          </div>
          <div class="message-text">
            <h4>Ready to Start a New Project?</h4>
            <p>When starting a new project, paste in the <strong>Starting Prompt</strong> from Settings and then open Nuts to run automation.</p>
            <ol>
              <li>Copy the Starting Prompt from the Settings tab</li>
              <li>Paste it into Bolt's chat input</li>
              <li>Wait for the project to be created</li>
              <li>Come back here to run task automation</li>
            </ol>
          </div>
        </div>
      `;

      const controlsDiv = document.querySelector(".automation-controls");
      if (controlsDiv) {
        controlsDiv.parentNode.insertBefore(messageDiv, controlsDiv);
      }
    }

    messageDiv.style.display = "block";
    this.hideUnsupportedMessage();
  }

  showNormalAutomationUI() {
    if (!this.runAutomationBtn) return;

    this.runAutomationBtn.disabled = false;
    this.runAutomationBtn.classList.remove("disabled");

    const settingsGroup = document.querySelector(".setting-group");
    if (settingsGroup) {
      settingsGroup.style.display = "flex";
    }

    this.hideStartingPromptMessage();
    this.hideUnsupportedMessage();
  }

  showUnsupportedUrlMessage() {
    if (!this.runAutomationBtn) return;

    this.runAutomationBtn.disabled = true;
    this.runAutomationBtn.classList.add("disabled");

    const settingsGroup = document.querySelector(".setting-group");
    if (settingsGroup) {
      settingsGroup.style.display = "none";
    }

    let messageDiv = document.getElementById("unsupportedUrlMessage");
    if (!messageDiv) {
      messageDiv = document.createElement("div");
      messageDiv.id = "unsupportedUrlMessage";
      messageDiv.className = "automation-message warning";
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="message-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <triangle points="12,2 2,20 22,20"></triangle>
              <path d="M12 8v8"></path>
              <circle cx="12" cy="20" r="1"></circle>
            </svg>
          </div>
          <div class="message-text">
            <h4>Unsupported URL</h4>
            <p>Automation only works on Bolt.new pages. Navigate to <strong>bolt.new</strong> to start a new project or open an existing project.</p>
          </div>
        </div>
      `;

      const controlsDiv = document.querySelector(".automation-controls");
      if (controlsDiv) {
        controlsDiv.parentNode.insertBefore(messageDiv, controlsDiv);
      }
    }

    messageDiv.style.display = "block";
    this.hideStartingPromptMessage();
  }

  hideStartingPromptMessage() {
    const messageDiv = document.getElementById("startingPromptMessage");
    if (messageDiv) {
      messageDiv.style.display = "none";
    }
  }

  hideUnsupportedMessage() {
    const messageDiv = document.getElementById("unsupportedUrlMessage");
    if (messageDiv) {
      messageDiv.style.display = "none";
    }
  }

  async runStartingSequence() {
    this.updateStatus("Running starting sequence...");

    const appSettings = window.settingsManager
      ? window.settingsManager.getSettings()
      : {};
    const combinedSettings = { ...this.settings, ...appSettings };

    window.parent.postMessage(
      {
        type: "RUN_STARTING_SEQUENCE",
        settings: combinedSettings,
      },
      "*"
    );
  }

  async runTaskSequence() {
    this.updateStatus("Starting task sequence...");

    if (this.tasks.length === 0) {
      this.updateStatus("No tasks found");
      this.stopAutomation();
      return;
    }

    const sortedTasks = this.getSortedTasks();
    const firstIncompleteIndex = sortedTasks.findIndex(
      (task) => !task.completed
    );

    if (firstIncompleteIndex === -1) {
      this.updateStatus("All tasks completed");
      this.stopAutomation();
      return;
    }

    const firstTask = sortedTasks[firstIncompleteIndex];

    await this.executeTask(firstTask, firstIncompleteIndex, sortedTasks.length);
  }

  getSortedTasks() {
    const tasksWithSortOrder = [...this.tasks];

    tasksWithSortOrder.forEach((task, index) => {
      if (task.sortOrder === undefined) {
        task.sortOrder = index;
      }
    });

    return tasksWithSortOrder.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  async executeTask(task, index, total) {
    if (!this.isRunning) return;

    this.currentTaskIndex = index;

    this.showRunningAutomationUI(task, index, total);

    this.updateStatus(
      `Running task ${index + 1}/${total}: ${task.text.substring(0, 50)}...`
    );

    const appSettings = window.settingsManager
      ? window.settingsManager.getSettings()
      : {};
    const combinedSettings = { ...this.settings, ...appSettings };

    let taskText = task.text;
    if (appSettings.appendPrompt && appSettings.appendPrompt.trim()) {
      taskText = `${task.text}\n\n${appSettings.appendPrompt}`;
    }

    window.parent.postMessage(
      {
        type: "EXECUTE_TASK",
        task: { ...task, text: taskText },
        taskIndex: index,
        totalTasks: total,
        settings: combinedSettings,
      },
      "*"
    );
  }

  handleStepComplete(data) {
    if (!this.isRunning) return;

    if (data.taskIndex !== undefined) {
      if (data.task && data.task.id) {
        const task = this.tasks.find((t) => t.id === data.task.id);
        if (task) {
          task.completed = true;
          task.completedAt = new Date().toISOString();

          if (window.projectManager && window.projectManager.projectData) {
            const projectTask = window.projectManager.projectData.todos.find(
              (t) => t.id === task.id
            );
            if (projectTask) {
              projectTask.completed = true;
              projectTask.completedAt = new Date().toISOString();
              window.projectManager.saveProjectData();
              window.projectManager.renderTodos();
            }
          }
        }
      }

      const sortedTasks = this.getSortedTasks();
      const nextIncompleteIndex = sortedTasks.findIndex(
        (task, index) => index > data.taskIndex && !task.completed
      );

      if (nextIncompleteIndex !== -1) {
        const nextTask = sortedTasks[nextIncompleteIndex];

        if (this.settings.autoContinue) {
          this.updateStatus("Waiting before next task...");
          setTimeout(() => {
            this.executeTask(nextTask, nextIncompleteIndex, sortedTasks.length);
          }, 5000);
        } else {
          this.currentTaskIndex = nextIncompleteIndex;
          this.updateStatus("Task completed. Click 'Next Task' to continue.");
          this.showNextTaskButton(
            nextTask,
            nextIncompleteIndex,
            sortedTasks.length
          );
        }
      } else {
        this.updateStatus("All tasks completed!");
        setTimeout(() => {
          this.stopAutomation();
        }, 2000);
      }
    } else if (data.sequenceType === "starting") {
      this.updateStatus("Starting sequence completed");
      setTimeout(() => this.stopAutomation(), 1000);
    }
  }

  handleAutomationError(data) {
    console.error("Automation error:", data.error);
    this.updateStatus(`Error: ${data.error}`);
    setTimeout(() => this.stopAutomation(), 3000);
  }

  stopAutomation() {
    this.isRunning = false;
    this.currentTaskIndex = 0;

    document.body.classList.remove("automation-running");

    this.restoreAutomationTab();

    window.parent.postMessage(
      {
        type: "STOP_AUTOMATION",
      },
      "*"
    );

    this.updateStatus("Stopped");
  }

  updateStatus(message) {
    if (this.automationStatusText) {
      this.automationStatusText.textContent = message;
    }
  }

  onTaskCompleted(taskId) {
    if (this.isRunning && this.settings.autoContinue) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) {
        task.completed = true;
      }
    }
  }

  getAutomationStatus() {
    const sortedTasks = this.getSortedTasks();
    return {
      isRunning: this.isRunning,
      currentTaskIndex: this.currentTaskIndex,
      totalTasks: sortedTasks.filter((task) => !task.completed).length,
      settings: this.settings,
    };
  }

  showRunningAutomationUI(currentTask, currentIndex, totalTasks) {
    const automationTab = document.getElementById("automationTab");
    if (!automationTab) return;

    const sortedTasks = this.getSortedTasks();
    const completedTasks = sortedTasks.filter((t) => t.completed).length;
    const taskProgress = completedTasks + 1;

    automationTab.innerHTML = `
      <div class="running-automation-container">
        <div class="running-header">
          <div class="loading-spinner">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" stroke-dasharray="16" stroke-dashoffset="16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3c4.97 0 9 4.03 9 9">
                <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.2s" values="16;0"/>
                <animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/>
              </path>
            </svg>
          </div>
          <div class="running-text">
            <h3>Running Automation</h3>
            <p>${taskProgress} of ${totalTasks} Tasks</p>
          </div>
        </div>
        
        <div class="current-task">
          <h4>Current Task:</h4>
          <p>${CoreUtils.escapeHtml(currentTask.text)}</p>
        </div>

        <div class="automation-status">
          <p id="runningStatusText">${
            this.automationStatusText?.textContent || "Starting task..."
          }</p>
        </div>

        <div class="running-controls">
          <button id="stopRunningBtn" class="stop-automation-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-2a1.5 1.5 0 1 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2h.208a6 6 0 0 1-5.012-2.7L7 19q-.468-.718-3.286-5.728a1.5 1.5 0 0 1 .536-2.022a1.87 1.87 0 0 1 2.28.28L8 13"/></g></svg>
            Stop
          </button>
          <button id="nextTaskBtn" class="next-task-btn hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9,18 15,12 9,6"></polyline>
            </svg>
            Next Task
          </button>
        </div>
      </div>
    `;

    const stopBtn = document.getElementById("stopRunningBtn");
    const nextBtn = document.getElementById("nextTaskBtn");

    if (stopBtn) {
      stopBtn.addEventListener("click", () => this.stopAutomation());
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.executeNextTask());
    }

    this.automationStatusText = document.getElementById("runningStatusText");
  }

  showNextTaskButton(nextTask, nextIndex, totalTasks) {
    const nextBtn = document.getElementById("nextTaskBtn");
    if (nextBtn) {
      nextBtn.classList.remove("hidden");
      nextBtn.onclick = () =>
        this.executeNextTask(nextTask, nextIndex, totalTasks);
    }
  }

  executeNextTask(task, index, total) {
    const nextBtn = document.getElementById("nextTaskBtn");
    if (nextBtn) {
      nextBtn.classList.add("hidden");
    }

    if (task && index !== undefined && total) {
      this.executeTask(task, index, total);
    } else {
      const sortedTasks = this.getSortedTasks();
      const nextIncompleteIndex = sortedTasks.findIndex(
        (task, index) => index > this.currentTaskIndex && !task.completed
      );

      if (nextIncompleteIndex !== -1) {
        const nextTask = sortedTasks[nextIncompleteIndex];
        this.executeTask(nextTask, nextIncompleteIndex, sortedTasks.length);
      } else {
        this.updateStatus("No more tasks to execute");
        this.stopAutomation();
      }
    }
  }

  restoreAutomationTab() {
    const automationTab = document.getElementById("automationTab");
    if (!automationTab) return;

    automationTab.innerHTML = `
     
      <div class="automation-settings">
        <div class="setting-group">
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" id="autoSupabaseMigration" class="setting-toggle">
              <span class="toggle-slider"></span>
              <span class="setting-title">Auto Run Supabase Migration</span>
            </label>
            <p class="setting-description">Automatically run database migrations when detected</p>
          </div>
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" id="autoErrorFix" class="setting-toggle">
              <span class="toggle-slider"></span>
              <span class="setting-title">Auto Run Error Fix</span>
            </label>
            <p class="setting-description">Automatically attempt to fix errors</p>
          </div>
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" id="autoContinue" class="setting-toggle">
              <span class="toggle-slider"></span>
              <span class="setting-title">Auto Continue</span>
            </label>
            <p class="setting-description">Automatically continue to next task after completion</p>
          </div>
        </div>
        <div class="automation-status">
          <div id="automationProgress" class="progress-info hidden">
            <div class="progress-spinner"></div>
            <span id="automationStatusText">Ready</span>
          </div>
        </div>
        <div class="automation-controls">
          <div class="automation-buttons">
            <button id="runAutomationBtn" class="run-automation-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21 5,3"></polygon>
              </svg>
              Run Automation
            </button>
            <button id="stopAutomationBtn" class="stop-automation-btn hidden">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-2a1.5 1.5 0 1 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2h.208a6 6 0 0 1-5.012-2.7L7 19q-.468-.718-3.286-5.728a1.5 1.5 0 0 1 .536-2.022a1.87 1.87 0 0 1 2.28.28L8 13"/></g></svg>
              Stop
            </button>
          </div>
          <p id="automationDescription" class="automation-description">The automator will run 0 active tasks (of 0) and will paste each task into the prompt box and wait.</p>
        </div>
      </div>
    `;

    this.initElements();
    this.setupEventListeners();
    this.loadSettings();

    setTimeout(() => {
      this.refreshTasks();
      this.checkUrlAndUpdateUI();
    }, 100);
  }
}

window.AutomationManager = AutomationManager;
