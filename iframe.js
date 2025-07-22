// Iframe main entry point
class IframeApp {
  constructor() {
    this.initializeApp();
  }

  initializeApp() {
    // Load the project icon
    this.loadProjectIcon();

    // Initialize all managers
    window.uiManager = new UIManager();
    window.projectManager = new ProjectManager();
    window.chatManager = new ChatManager();
    window.automationManager = new AutomationManager();
    window.settingsManager = new SettingsManager();

    // Load initial project list
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

// Initialize the app when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new IframeApp();
  });
} else {
  new IframeApp();
}
