// Automation Manager - handles automation settings and execution
class AutomationManager {
  constructor() {
    this.isRunning = false;
    this.currentTaskIndex = 0;
    this.tasks = [];
    this.settings = {
      autoSupabaseMigration: false,
      autoErrorFix: false,
      autoContinue: true,
      slowType: true, // Default to human-like typing
    };

    this.initElements();
    this.setupEventListeners();
    this.loadSettings();
  }

  initElements() {
    this.autoSupabaseMigrationToggle = document.getElementById(
      "autoSupabaseMigration"
    );
    this.autoErrorFixToggle = document.getElementById("autoErrorFix");
    this.autoContinueToggle = document.getElementById("autoContinue");
    this.slowTypeToggle = document.getElementById("slowType");
    this.runAutomationBtn = document.getElementById("runAutomationBtn");
    this.stopAutomationBtn = document.getElementById("stopAutomationBtn");
    this.automationProgress = document.getElementById("automationProgress");
    this.automationStatusText = document.getElementById("automationStatusText");
  }

  setupEventListeners() {
    // Settings toggles
    this.autoSupabaseMigrationToggle.addEventListener("change", (e) => {
      this.settings.autoSupabaseMigration = e.target.checked;
      this.saveSettings();
    });

    this.autoErrorFixToggle.addEventListener("change", (e) => {
      this.settings.autoErrorFix = e.target.checked;
      this.saveSettings();
    });

    this.autoContinueToggle.addEventListener("change", (e) => {
      this.settings.autoContinue = e.target.checked;
      this.saveSettings();
    });

    this.slowTypeToggle.addEventListener("change", (e) => {
      this.settings.slowType = e.target.checked;
      this.saveSettings();
    });

    // Automation controls
    this.runAutomationBtn.addEventListener("click", () =>
      this.startAutomation()
    );
    this.stopAutomationBtn.addEventListener("click", () =>
      this.stopAutomation()
    );

    // Listen for project changes
    eventBus.on("project:loaded", (projectData) => {
      this.tasks = projectData.todos || [];
    });

    // Listen for responses from content script
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
    } catch (error) {
      console.error("Error loading automation settings:", error);
    }
  }

  async saveSettings() {
    try {
      await StorageManager.set("automation_settings", this.settings);
      console.log("Automation settings saved:", this.settings);
    } catch (error) {
      console.error("Error saving automation settings:", error);
    }
  }

  updateToggleStates() {
    this.autoSupabaseMigrationToggle.checked =
      this.settings.autoSupabaseMigration;
    this.autoErrorFixToggle.checked = this.settings.autoErrorFix;
    this.autoContinueToggle.checked = this.settings.autoContinue;
    this.slowTypeToggle.checked = this.settings.slowType;
  }

  async startAutomation() {
    if (this.isRunning) return;

    console.log("Starting automation sequence...");
    this.isRunning = true;
    this.currentTaskIndex = 0;

    // Add automation-running class to hide header and tabs
    document.body.classList.add("automation-running");

    // Update UI
    this.runAutomationBtn.classList.add("hidden");
    this.stopAutomationBtn.classList.remove("hidden");
    this.automationProgress.classList.remove("hidden");
    this.updateStatus("Initializing...");

    try {
      // Check current URL and determine sequence
      const currentUrl = await this.getCurrentUrl();
      console.log("Current URL:", currentUrl);

      if (
        currentUrl === "https://bolt.new" ||
        currentUrl === "https://bolt.new/"
      ) {
        // Run starting sequence
        await this.runStartingSequence();
      } else if (currentUrl.startsWith("https://bolt.new/")) {
        // Run task sequence
        await this.runTaskSequence();
      } else {
        throw new Error("Automation can only run on bolt.new pages");
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

  async runStartingSequence() {
    this.updateStatus("Running starting sequence...");

    // Get current settings including starter prompt
    const appSettings = window.settingsManager
      ? window.settingsManager.getSettings()
      : {};
    const combinedSettings = { ...this.settings, ...appSettings };

    // Send message to content script to handle starting sequence
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

    // Filter to only incomplete tasks
    const incompleteTasks = this.tasks.filter((task) => !task.completed);

    if (incompleteTasks.length === 0) {
      this.updateStatus("No incomplete tasks found");
      this.stopAutomation();
      return;
    }

    console.log(`Total tasks: ${this.tasks.length}`);
    console.log(
      `Found ${incompleteTasks.length} incomplete tasks:`,
      incompleteTasks.map((t) => t.text)
    );

    // Start with first incomplete task
    const firstTask = incompleteTasks[0];
    const firstTaskIndex = this.tasks.findIndex((t) => t.id === firstTask.id);
    console.log(
      `Starting with task: "${firstTask.text}" (index ${firstTaskIndex} in original array)`
    );

    await this.executeTask(firstTask, firstTaskIndex, this.tasks.length);
  }

  async executeTask(task, index, total) {
    if (!this.isRunning) return;

    this.currentTaskIndex = index;

    // Show running automation UI
    this.showRunningAutomationUI(task, index, total);

    this.updateStatus(
      `Running task ${index + 1}/${total}: ${task.text.substring(0, 50)}...`
    );

    console.log("Executing task:", task.text);

    // Get current settings including append prompt
    const appSettings = window.settingsManager
      ? window.settingsManager.getSettings()
      : {};
    const combinedSettings = { ...this.settings, ...appSettings };

    // Modify task text to include append prompt if specified
    let taskText = task.text;
    if (appSettings.appendPrompt && appSettings.appendPrompt.trim()) {
      taskText = `${task.text}\n\n${appSettings.appendPrompt}`;
    }

    // Send task to content script for execution
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

    console.log("Step completed:", data);

    if (data.taskIndex !== undefined) {
      // Mark the current task as completed if we have task data
      if (data.task && data.task.id) {
        const task = this.tasks.find((t) => t.id === data.task.id);
        if (task) {
          task.completed = true;
          console.log(`Marked task ${task.id} as completed:`, task.text);
        }
      }

      // Get fresh list of incomplete tasks
      const incompleteTasks = this.tasks.filter((task) => !task.completed);
      console.log(
        `${incompleteTasks.length} tasks remaining:`,
        incompleteTasks.map((t) => t.text)
      );

      if (incompleteTasks.length > 0) {
        // Find the next task to execute
        const nextTask = incompleteTasks[0]; // Always take the first incomplete task
        const nextTaskIndex = this.tasks.findIndex((t) => t.id === nextTask.id); // Find its index in the original array

        console.log(
          `Next task: "${nextTask.text}" (index ${nextTaskIndex} in original array)`
        );

        if (this.settings.autoContinue) {
          // Continue to next task with longer delay to ensure page stability
          this.updateStatus("Waiting before next task...");
          setTimeout(() => {
            this.executeTask(
              nextTask,
              nextTaskIndex,
              this.tasks.length // Use original task count, not incomplete count
            );
          }, 5000); // Wait 5 seconds between tasks for page to fully stabilize
        } else {
          // Auto-continue is disabled, wait for user to click next
          this.currentTaskIndex = nextTaskIndex;
          this.updateStatus("Task completed. Click 'Next Task' to continue.");
          this.showNextTaskButton(nextTask, nextTaskIndex, this.tasks.length);
        }
      } else {
        // All tasks completed
        this.updateStatus("All tasks completed!");
        setTimeout(() => {
          this.stopAutomation();
        }, 2000);
      }
    } else if (data.sequenceType === "starting") {
      // Starting sequence completed
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
    console.log("Stopping automation...");
    this.isRunning = false;
    this.currentTaskIndex = 0;

    // Remove automation-running class
    document.body.classList.remove("automation-running");

    // Restore original automation tab
    this.restoreAutomationTab();

    // Notify content script to stop
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
    console.log("Automation status:", message);
  }

  // Handle automation events from other components
  onTaskCompleted(taskId) {
    if (this.isRunning && this.settings.autoContinue) {
      // Mark task as completed in our local copy
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) {
        task.completed = true;
      }
    }
  }

  getAutomationStatus() {
    return {
      isRunning: this.isRunning,
      currentTaskIndex: this.currentTaskIndex,
      totalTasks: this.tasks.filter((task) => !task.completed).length,
      settings: this.settings,
    };
  }

  showRunningAutomationUI(currentTask, currentIndex, totalTasks) {
    // Hide normal automation tab content and show running UI
    const automationTab = document.getElementById("automationTab");
    if (!automationTab) return;

    // Calculate progress: how many tasks have been completed + 1 for current
    const completedTasks = this.tasks.filter((t) => t.completed).length;
    const taskProgress = completedTasks + 1; // +1 for the current task being executed

    console.log(
      `Showing running UI: Task ${taskProgress} of ${totalTasks} - "${currentTask.text}"`
    );

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

    // Setup event listeners
    const stopBtn = document.getElementById("stopRunningBtn");
    const nextBtn = document.getElementById("nextTaskBtn");

    if (stopBtn) {
      stopBtn.addEventListener("click", () => this.stopAutomation());
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.executeNextTask());
    }

    // Update the status text element reference
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
    // Hide next button and continue with task
    const nextBtn = document.getElementById("nextTaskBtn");
    if (nextBtn) {
      nextBtn.classList.add("hidden");
    }

    if (task && index !== undefined && total) {
      this.executeTask(task, index, total);
    } else {
      // Get the next incomplete task
      const incompleteTasks = this.tasks.filter((t) => !t.completed);
      if (incompleteTasks.length > 0) {
        const nextTask = incompleteTasks[0];
        const nextTaskIndex = this.tasks.findIndex((t) => t.id === nextTask.id);
        this.executeTask(nextTask, nextTaskIndex, this.tasks.length);
      } else {
        this.updateStatus("No more tasks to execute");
        this.stopAutomation();
      }
    }
  }

  restoreAutomationTab() {
    // Restore the original automation tab content
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
            <p class="setting-description">Automatically attempt to fix errors up to 3 times</p>
          </div>
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" id="autoContinue" class="setting-toggle">
              <span class="toggle-slider"></span>
              <span class="setting-title">Auto Continue</span>
            </label>
            <p class="setting-description">Automatically continue to next task after completion</p>
          </div>
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" id="slowType" class="setting-toggle">
              <span class="toggle-slider"></span>
              <span class="setting-title">Slow Type</span>
            </label>
            <p class="setting-description">Type like a human with realistic delays (vs instant typing)</p>
          </div>
        </div>
        <div class="automation-status">
          <div id="automationProgress" class="progress-info hidden">
            <div class="progress-spinner"></div>
            <span id="automationStatusText">Ready</span>
          </div>
        </div>
        <div class="automation-controls">
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
      </div>
    `;

    // Re-initialize elements and event listeners
    this.initElements();
    this.setupEventListeners();
    this.loadSettings();
  }
}

// Make AutomationManager globally available
window.AutomationManager = AutomationManager;
