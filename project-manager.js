// Project Manager - handles project CRUD operations
class ProjectManager {
  constructor() {
    this.currentProject = null;
    this.projectData = null;
    this.allProjects = {};

    this.initElements();
    this.setupEventListeners();
  }

  initElements() {
    this.projectsGrid = document.getElementById("projectsGrid");
    this.newProjectBtn = document.getElementById("newProjectBtn");
    this.todosList = document.getElementById("todosList");
    this.addTodoBtn = document.getElementById("addTodoBtn");
    this.todoInputContainer = document.getElementById("todoInputContainer");
    this.todoInput = document.getElementById("todoInput");
    this.saveTodoBtn = document.getElementById("saveTodoBtn");
    this.cancelTodoBtn = document.getElementById("cancelTodoBtn");
    this.automationList = document.getElementById("automationList");
    this.addAutomationBtn = document.getElementById("addAutomationBtn");
  }

  setupEventListeners() {
    this.newProjectBtn.addEventListener("click", () =>
      this.showNewProjectModal()
    );

    // Todo management
    this.addTodoBtn.addEventListener("click", () => this.showTodoInput());
    this.saveTodoBtn.addEventListener("click", () => this.saveTodo());
    this.cancelTodoBtn.addEventListener("click", () => this.hideTodoInput());
    this.todoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.saveTodo();
    });

    this.addAutomationBtn.addEventListener("click", () => this.addAutomation());

    // Listen to events
    eventBus.on("view:projectList", () => this.loadAllProjects());
    eventBus.on("clear:tab", (tab) => this.clearTabData(tab));
    eventBus.on("project:delete", () => this.deleteCurrentProject());
    eventBus.on("ai:function", (data) => this.handleAIFunction(data));

    // Message listener for external communication
    window.addEventListener("message", (event) => {
      const { type, project, data } = event.data;

      switch (type) {
        case "PROJECT_DATA":
          this.loadProjectData(project, data);
          break;
        case "PROJECT_CHANGED":
          this.loadProjectData(project, data);
          break;
      }
    });
  }

  async loadAllProjects() {
    try {
      const allData = await StorageManager.getAll();
      this.allProjects = {};

      Object.keys(allData).forEach((key) => {
        if (key.startsWith("project_")) {
          const projectId = key.replace("project_", "");
          this.allProjects[projectId] = allData[key];
        }
      });

      this.renderProjectList();
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }

  renderProjectList() {
    const projectKeys = Object.keys(this.allProjects);

    if (projectKeys.length === 0) {
      this.projectsGrid.innerHTML = `
        <div class="empty-state">
          <p>No projects found. Create your first project to get started!</p>
        </div>
      `;
      return;
    }

    const projectCards = projectKeys
      .map((projectId) => {
        const project = this.allProjects[projectId];
        const todoCount = project.todos?.length || 0;
        const chatCount = project.chatHistory?.length || 0;
        const completedTodos =
          project.todos?.filter((t) => t.completed).length || 0;
        const lastUpdated = CoreUtils.formatDate(
          project.lastUpdated || project.createdAt
        );
        const title = project.title || projectId;
        const techStack = project.techStack || ["React", "Vite"];

        const techBadges = techStack
          .map(
            (tech) =>
              `<span class="tech-badge-${tech.toLowerCase()}">${tech}</span>`
          )
          .join("");

        return `
        <div class="project-card" onclick="window.projectManager.openProject('${projectId}')">
          <h4>${CoreUtils.escapeHtml(title)}</h4>
          <div class="project-tech">${techBadges}</div>
          <div class="project-meta">Last updated: ${lastUpdated}</div>
          <div class="project-stats">
            <span>Tasks: ${completedTodos}/${todoCount}</span>
            <span>Messages: ${chatCount}</span>
          </div>
        </div>
      `;
      })
      .join("");

    this.projectsGrid.innerHTML = `<div class="grid">${projectCards}</div>`;
  }

  openProject(projectId) {
    this.currentProject = projectId;
    this.projectData = this.allProjects[projectId];

    window.uiManager.updateProjectHeader(this.projectData);
    this.renderTodos();
    this.renderAutomations();

    eventBus.emit("project:loaded", this.projectData);
  }

  loadProjectData(project, data) {
    this.currentProject = project;
    this.projectData = data || {
      todos: [],
      chatHistory: [],
      automations: [],
      title: project,
      techStack: ["React", "Vite"],
      createdAt: new Date().toISOString(),
    };

    window.uiManager.updateProjectHeader(this.projectData);
    this.renderTodos();
    this.renderAutomations();

    eventBus.emit("project:loaded", this.projectData);
  }

  showNewProjectModal() {
    console.log("Showing new project modal");

    const modalContent = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New Project</h3>
          <button class="modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Project Title</label>
            <input type="text" id="newProjectTitle" placeholder="My Awesome App" />
          </div>
          <div class="form-group">
            <label>Project Description / Braindump</label>
            <textarea id="newProjectDescription" rows="4" placeholder="Braindump your ideas here and they will be turned into a web app task list by Nuts AI. Describe features, user stories, technical requirements, or anything else about your project..."></textarea>
          </div>
          <div class="form-group">
            <label>Tech Stack</label>
            <div class="tech-stack-selector">
              <label class="tech-checkbox">
                <input type="checkbox" value="React" checked> React
              </label>
              <label class="tech-checkbox">
                <input type="checkbox" value="Vite" checked> Vite
              </label>
              <label class="tech-checkbox">
                <input type="checkbox" value="Supabase"> Supabase
              </label>
              <label class="tech-checkbox">
                <input type="checkbox" value="Netlify"> Netlify
              </label>
              <label class="tech-checkbox">
                <input type="checkbox" value="TypeScript"> TypeScript
              </label>
              <label class="tech-checkbox">
                <input type="checkbox" value="Tailwind"> Tailwind
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-close cancel-btn">Cancel</button>
          <button id="createProjectBtn" class="create-btn">Create Project</button>
        </div>
      </div>
    `;

    const modal = window.uiManager.showModal(modalContent);

    // Setup modal close handlers
    modal.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        console.log("Closing modal");
        modal.remove();
      });
    });

    // Setup create project button
    const createBtn = modal.querySelector("#createProjectBtn");
    createBtn.addEventListener("click", () => {
      console.log("Create project clicked");
      this.createNewProject();
    });

    // Focus the title input
    setTimeout(() => {
      const titleInput = document.getElementById("newProjectTitle");
      if (titleInput) titleInput.focus();
    }, 100);
  }

  createNewProject() {
    console.log("Creating new project");

    const titleInput = document.getElementById("newProjectTitle");
    const descriptionInput = document.getElementById("newProjectDescription");
    const techCheckboxes = document.querySelectorAll(
      'input[type="checkbox"]:checked'
    );

    if (!titleInput || !descriptionInput) {
      console.error("Form inputs not found");
      return;
    }

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const techStack = Array.from(techCheckboxes).map((cb) => cb.value);

    console.log("Form data:", { title, description, techStack });

    if (!title) {
      alert("Please enter a project title");
      return;
    }

    const projectId = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const projectData = {
      title,
      description,
      techStack: techStack.length > 0 ? techStack : ["React", "Vite"],
      todos: [],
      chatHistory: [],
      automations: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    console.log("Creating project with data:", projectData);

    // Generate initial tasks if description provided
    if (description) {
      projectData.chatHistory.push({
        id: CoreUtils.generateId(),
        role: "user",
        content: `New project: ${title}\n\nDescription: ${description}`,
        timestamp: new Date().toISOString(),
      });

      window.parent.postMessage(
        {
          type: "GENERATE_TASKS_FROM_DESCRIPTION",
          data: { projectId, projectData, description },
        },
        "*"
      );
    }

    this.currentProject = projectId;
    this.projectData = projectData;
    this.allProjects[projectId] = projectData;

    // Save the project
    this.saveProjectData();

    // Close modal
    window.uiManager.hideModal();

    console.log("Project created, showing main view");
    eventBus.emit("project:created", projectData);
  }

  // Todo management
  showTodoInput() {
    this.todoInputContainer.classList.remove("hidden");
    this.todoInput.focus();
    this.addTodoBtn.style.opacity = "0.5";
  }

  hideTodoInput() {
    this.todoInputContainer.classList.add("hidden");
    this.todoInput.value = "";
    this.addTodoBtn.style.opacity = "1";
  }

  saveTodo() {
    const text = this.todoInput.value.trim();
    if (!text) return;

    const todo = {
      id: CoreUtils.generateId(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.projectData.todos.push(todo);
    this.saveProjectData();
    this.renderTodos();
    this.hideTodoInput();
  }

  toggleTodo(todoId) {
    const todo = this.projectData.todos.find((t) => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      todo.updatedAt = new Date().toISOString();
      this.saveProjectData();
      this.renderTodos();
    }
  }

  deleteTodo(todoId) {
    this.projectData.todos = this.projectData.todos.filter(
      (t) => t.id !== todoId
    );
    this.saveProjectData();
    this.renderTodos();
  }

  renderTodos() {
    if (!this.projectData?.todos || this.projectData.todos.length === 0) {
      this.todosList.innerHTML = `
        <div class="empty-state">
          <p>No tasks yet. Add one to get started!</p>
        </div>
      `;
      return;
    }

    const sortedTodos = [...this.projectData.todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const todoItems = sortedTodos
      .map(
        (todo) => `
      <div class="todo-item ${todo.completed ? "completed" : ""}">
        <input type="checkbox" ${todo.completed ? "checked" : ""} 
               onchange="window.projectManager.toggleTodo('${todo.id}')"
               class="todo-checkbox">
        <span class="todo-text">${CoreUtils.escapeHtml(todo.text)}</span>
        <div class="todo-actions">
          <button onclick="window.projectManager.deleteTodo('${todo.id}')" 
                  class="delete-btn" title="Delete task">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `
      )
      .join("");

    this.todosList.innerHTML = todoItems;
  }

  // AI Function handling
  handleAIFunction(data) {
    const { name, arguments: args } = data;

    switch (name) {
      case "add_task":
        this.addTaskFromAI(args.task, args.priority);
        break;
      case "complete_task":
        this.completeTaskFromAI(args.task_id);
        break;
      case "remove_task":
        this.removeTaskFromAI(args.task_id);
        break;
      case "edit_task":
        this.editTaskFromAI(args.task_id, args.new_text);
        break;
    }

    this.saveProjectData();
    this.renderTodos();
  }

  addTaskFromAI(taskText, priority = "normal") {
    const todo = {
      id: CoreUtils.generateId(),
      text: taskText,
      completed: false,
      priority,
      createdAt: new Date().toISOString(),
      createdBy: "ai",
    };
    this.projectData.todos.push(todo);
  }

  completeTaskFromAI(taskId) {
    const todo = this.projectData.todos.find(
      (t) =>
        t.id === taskId || t.text.toLowerCase().includes(taskId.toLowerCase())
    );
    if (todo) {
      todo.completed = true;
      todo.completedAt = new Date().toISOString();
    }
  }

  removeTaskFromAI(taskId) {
    this.projectData.todos = this.projectData.todos.filter(
      (t) =>
        t.id !== taskId && !t.text.toLowerCase().includes(taskId.toLowerCase())
    );
  }

  editTaskFromAI(taskId, newText) {
    const todo = this.projectData.todos.find(
      (t) =>
        t.id === taskId || t.text.toLowerCase().includes(taskId.toLowerCase())
    );
    if (todo) {
      todo.text = newText;
      todo.updatedAt = new Date().toISOString();
    }
  }

  // Automation management
  addAutomation() {
    const name = prompt("Enter automation rule name:");
    if (!name) return;

    const description = prompt("Enter automation description:");
    if (!description) return;

    const automation = {
      id: CoreUtils.generateId(),
      name: name.trim(),
      description: description.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    if (!this.projectData.automations) {
      this.projectData.automations = [];
    }

    this.projectData.automations.push(automation);
    this.saveProjectData();
    this.renderAutomations();
  }

  renderAutomations() {
    if (
      !this.projectData?.automations ||
      this.projectData.automations.length === 0
    ) {
      this.automationList.innerHTML = `
        <div class="empty-state">
          <p>No automation rules yet. Create rules to automate your workflow!</p>
        </div>
      `;
      return;
    }

    const automationItems = this.projectData.automations
      .map(
        (automation) => `
      <div class="automation-item">
        <h5>${CoreUtils.escapeHtml(automation.name)}</h5>
        <p>${CoreUtils.escapeHtml(automation.description)}</p>
        <span class="automation-status ${
          automation.active ? "active" : "inactive"
        }">
          ${automation.active ? "Active" : "Inactive"}
        </span>
      </div>
    `
      )
      .join("");

    this.automationList.innerHTML = automationItems;
  }

  clearTabData(tab) {
    switch (tab) {
      case "tasks":
        this.projectData.todos = [];
        this.renderTodos();
        break;
      case "chat":
        this.projectData.chatHistory = [];
        eventBus.emit("chat:cleared");
        break;
      case "automation":
        this.projectData.automations = [];
        this.renderAutomations();
        break;
    }
    this.saveProjectData();
  }

  async deleteCurrentProject() {
    if (!this.currentProject) return;

    await StorageManager.remove(`project_${this.currentProject}`);
    delete this.allProjects[this.currentProject];

    this.currentProject = null;
    this.projectData = null;

    eventBus.emit("project:list");
  }

  saveProjectData() {
    if (!this.currentProject || !this.projectData) return;

    this.projectData.lastUpdated = new Date().toISOString();

    // Save to local storage via StorageManager
    StorageManager.set(`project_${this.currentProject}`, this.projectData);

    // Also notify parent window
    window.parent.postMessage(
      {
        type: "SAVE_PROJECT_DATA",
        data: this.projectData,
      },
      "*"
    );
  }
}

// Make ProjectManager globally available
window.ProjectManager = ProjectManager;
