// Main iframe script - initializes and coordinates all managers
class NutsForBolt {
  constructor() {
    this.uiManager = null;
    this.projectManager = null;
    this.chatManager = null;

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initialize());
    } else {
      this.initialize();
    }
  }

  initialize() {
    console.log("Nuts for Bolt initializing...");

    // Initialize managers in order
    this.uiManager = new UIManager();
    this.projectManager = new ProjectManager();
    this.chatManager = new ChatManager();

    // Make managers globally available
    window.uiManager = this.uiManager;
    window.projectManager = this.projectManager;
    window.chatManager = this.chatManager;

    // Setup communication with parent window
    this.setupParentCommunication();

    // Start with project list view
    setTimeout(() => {
      this.projectManager.loadAllProjects();
    }, 500);

    console.log("Nuts for Bolt initialized successfully!");
  }

  setupParentCommunication() {
    // Listen for messages from content script
    window.addEventListener("message", (event) => {
      const { type, project, data } = event.data;

      switch (type) {
        case "PROJECT_DATA":
        case "PROJECT_CHANGED":
          this.projectManager.loadProjectData(project, data);
          this.uiManager.showMainView();
          break;
      }
    });
  }
}

// Initialize the application
const app = new NutsForBolt();

// Make app globally available for debugging
window.nutsForBolt = app;
