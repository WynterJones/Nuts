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
  }

  async startAutomation() {
    if (this.isRunning) return;

    console.log("Starting automation sequence...");
    this.isRunning = true;
    this.currentTaskIndex = 0;

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

    // Send message to content script to handle starting sequence
    window.parent.postMessage(
      {
        type: "RUN_STARTING_SEQUENCE",
        settings: this.settings,
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

    console.log(`Found ${incompleteTasks.length} incomplete tasks`);

    // Start with first task
    await this.executeTask(incompleteTasks[0], 0, incompleteTasks.length);
  }

  async executeTask(task, index, total) {
    if (!this.isRunning) return;

    this.currentTaskIndex = index;
    this.updateStatus(
      `Running task ${index + 1}/${total}: ${task.text.substring(0, 50)}...`
    );

    console.log("Executing task:", task.text);

    // Send task to content script for execution
    window.parent.postMessage(
      {
        type: "EXECUTE_TASK",
        task: task,
        taskIndex: index,
        totalTasks: total,
        settings: this.settings,
      },
      "*"
    );
  }

  handleStepComplete(data) {
    if (!this.isRunning) return;

    console.log("Step completed:", data);

    if (data.taskIndex !== undefined) {
      // Task execution completed
      const incompleteTasks = this.tasks.filter((task) => !task.completed);
      const nextIndex = data.taskIndex + 1;

      if (nextIndex < incompleteTasks.length && this.settings.autoContinue) {
        // Continue to next task
        setTimeout(() => {
          this.executeTask(
            incompleteTasks[nextIndex],
            nextIndex,
            incompleteTasks.length
          );
        }, 2000); // Wait 2 seconds between tasks
      } else {
        // All tasks completed
        this.updateStatus("All tasks completed!");
        setTimeout(() => this.stopAutomation(), 2000);
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

    // Update UI
    this.runAutomationBtn.classList.remove("hidden");
    this.stopAutomationBtn.classList.add("hidden");
    this.automationProgress.classList.add("hidden");

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
    this.automationStatusText.textContent = message;
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
}

// Make AutomationManager globally available
window.AutomationManager = AutomationManager;
