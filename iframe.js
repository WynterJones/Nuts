// Iframe main entry point
class IframeApp {
  constructor() {
    this.initializeApp();
  }

  initializeApp() {
    // Initialize all managers
    window.uiManager = new UIManager();
    window.projectManager = new ProjectManager();
    window.chatManager = new ChatManager();
    window.automationManager = new AutomationManager();

    // Load initial project list
    window.projectManager.loadAllProjects();

    console.log("Nuts for Bolt iframe initialized");
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
