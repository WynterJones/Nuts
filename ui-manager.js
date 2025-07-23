class UIManager {
  constructor() {
    this.currentTab = "tasks";

    this.initElements();
    this.setupEventListeners();
    this.setupDragging();
  }

  initElements() {
    this.projectListView = document.getElementById("projectListView");
    this.mainProjectView = document.getElementById("mainProjectView");
    this.tabBtns = document.querySelectorAll(".tab-btn");
    this.tabPanes = document.querySelectorAll(".tab-pane");
    this.deleteProjectBtn = document.getElementById("deleteProjectBtn");
    this.closeBtn = document.getElementById("closeBtn");
    this.backBtn = document.getElementById("backBtn");
    this.projectName = document.getElementById("projectName");
  }

  setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    this.closeBtn.addEventListener("click", () => {
      window.parent.postMessage({ type: "CLOSE_IFRAME" }, "*");
    });

    this.backBtn.addEventListener("click", () => {
      eventBus.emit("project:list");
    });

    this.deleteProjectBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this project?")) {
        eventBus.emit("project:delete");
      }
    });

    eventBus.on("project:loaded", (projectData) => {
      this.updateProjectHeader(projectData);
      this.showMainView();
    });

    eventBus.on("project:created", (projectData) => {
      this.updateProjectHeader(projectData);
      this.showMainView();
    });

    eventBus.on("project:list", () => this.showProjectList());
  }

  setupDragging() {
    const header = document.querySelector(".header");
    const runningHeader = document.querySelector(".running-header");

    const draggableElements = [header, runningHeader].filter(Boolean);

    if (draggableElements.length === 0) {
      console.warn("No draggable header elements found");
      return;
    }

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const startDrag = (e) => {
      if (e.target.closest("button")) return;

      isDragging = true;
      lastX = e.screenX;
      lastY = e.screenY;

      document.body.style.userSelect = "none";
      e.preventDefault();

      console.log("✋ Dragging started");
    };

    draggableElements.forEach((element) => {
      element.addEventListener("mousedown", startDrag);
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const deltaX = e.screenX - lastX;
      const deltaY = e.screenY - lastY;

      lastX = e.screenX;
      lastY = e.screenY;

      window.parent.postMessage(
        {
          type: "MOVE_IFRAME",
          deltaX: deltaX,
          deltaY: deltaY,
        },
        "*"
      );
    });

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = "";
        console.log("✋ Dragging ended");
      }
    };

    document.addEventListener("mouseup", endDrag);
    document.addEventListener("mouseleave", endDrag);
  }

  switchTab(tabName) {
    console.log("Switching to tab:", tabName);
    this.currentTab = tabName;

    this.tabBtns.forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("active", isActive);
    });

    this.tabPanes.forEach((pane) => {
      const isActive = pane.id === `${tabName}Tab`;
      pane.classList.toggle("hidden", !isActive);
      if (isActive) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });

    eventBus.emit("tab:changed", tabName);
  }

  showProjectList() {
    this.projectListView.classList.remove("hidden");
    this.mainProjectView.classList.add("hidden");

    this.projectName.textContent = "Nuts for Bolt";
    this.backBtn.classList.add("hidden");
    this.deleteProjectBtn.classList.add("hidden");

    eventBus.emit("view:projectList");
  }

  showMainView() {
    this.projectListView.classList.add("hidden");
    this.mainProjectView.classList.remove("hidden");

    this.backBtn.classList.remove("hidden");
    this.deleteProjectBtn.classList.remove("hidden");

    this.switchTab("chat");
    eventBus.emit("view:mainProject");
  }

  closeAssistant() {
    window.parent.postMessage({ type: "CLOSE_IFRAME" }, "*");
  }

  clearCurrentTab() {
    const messages = {
      tasks: "Are you sure you want to clear all tasks?",
      chat: "Are you sure you want to clear the chat history?",
      automation: "Are you sure you want to clear all automations?",
    };

    const message = messages[this.currentTab];
    if (message && confirm(message)) {
      eventBus.emit("clear:tab", this.currentTab);
    }
  }

  deleteProject() {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone."
      )
    ) {
      eventBus.emit("project:delete");
    }
  }

  updateProjectHeader(projectData) {
    if (projectData && projectData.title) {
      this.projectName.textContent = projectData.title;
    }
  }

  showModal(content) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = content;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    return modal;
  }

  hideModal() {
    const modal = document.querySelector(".modal-overlay");
    if (modal) {
      modal.remove();
    }
  }
}

window.UIManager = UIManager;
