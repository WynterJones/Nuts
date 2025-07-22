// Project Manager - handles project CRUD operations
class ProjectManager {
  constructor() {
    this.currentProject = null;
    this.projectData = null;
    this.allProjects = {};
    this.saveTimeout = null; // For debouncing saves

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

    // Listen to events
    eventBus.on("view:projectList", () => this.loadAllProjects());
    eventBus.on("clear:tab", (tab) => this.clearTabData(tab));
    eventBus.on("project:delete", () => this.deleteCurrentProject());
    eventBus.on("ai:function", (data) => this.handleAIFunction(data));

    // Message listener for external communication
    window.addEventListener("message", (event) => {
      if (!event.data || !event.data.type) return;

      const { type } = event.data;

      switch (type) {
        case "PROJECT_DATA":
          if (event.data.project && event.data.data) {
            this.loadProjectData(event.data.project, event.data.data);
          }
          break;
        case "PROJECT_CHANGED":
          if (event.data.project && event.data.data) {
            this.loadProjectData(event.data.project, event.data.data);
          }
          break;
      }
    });
  }

  async loadAllProjects() {
    try {
      const allData = await StorageManager.getAll();
      this.allProjects = {};
      const seenTitles = new Map(); // Track title -> projectId mapping

      Object.keys(allData).forEach((key) => {
        if (key.startsWith("project_")) {
          const projectId = key.replace("project_", "");
          const projectData = allData[key];
          const title = projectData.title || projectId;
          const titleLower = title.toLowerCase();

          // Check for duplicates by title
          if (seenTitles.has(titleLower)) {
            const existingProjectId = seenTitles.get(titleLower);
            const existingProject = this.allProjects[existingProjectId];

            // Keep the more recent project (based on lastUpdated)
            const existingDate = new Date(
              existingProject.lastUpdated || existingProject.createdAt
            );
            const currentDate = new Date(
              projectData.lastUpdated || projectData.createdAt
            );

            if (currentDate > existingDate) {
              console.log(
                `Replacing older duplicate project: ${existingProjectId} with ${projectId}`
              );
              delete this.allProjects[existingProjectId];
              StorageManager.remove(`project_${existingProjectId}`); // Clean up storage
              this.allProjects[projectId] = projectData;
              seenTitles.set(titleLower, projectId);
            } else {
              console.log(`Removing older duplicate project: ${projectId}`);
              StorageManager.remove(`project_${projectId}`); // Clean up storage
            }
          } else {
            this.allProjects[projectId] = projectData;
            seenTitles.set(titleLower, projectId);
          }
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

    // Sort projects by last updated date (newest first)
    const sortedProjectKeys = projectKeys.sort((a, b) => {
      const projectA = this.allProjects[a];
      const projectB = this.allProjects[b];
      const dateA = new Date(projectA.lastUpdated || projectA.createdAt);
      const dateB = new Date(projectB.lastUpdated || projectB.createdAt);
      return dateB - dateA; // Newest first
    });

    const projectCards = sortedProjectKeys
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
        return `
        <div class="project-card" data-project-id="${projectId}">
          <h4>${CoreUtils.escapeHtml(title)}</h4>
          <div class="project-meta">Last updated: ${lastUpdated}</div>
          <div class="project-stats">
            <span>Tasks: ${completedTodos}/${todoCount}</span>
            <span>Messages: ${chatCount}</span>
          </div>
        </div>
      `;
      })
      .join("");

    // Create the grid structure directly without extra wrapper
    this.projectsGrid.innerHTML = `<div class="grid">${projectCards}</div>`;

    // Add click listeners after rendering
    this.setupProjectClickListeners();
  }

  setupProjectClickListeners() {
    const projectCards = this.projectsGrid.querySelectorAll(".project-card");
    projectCards.forEach((card) => {
      card.addEventListener("click", () => {
        const projectId = card.getAttribute("data-project-id");
        console.log("Project card clicked:", projectId);
        this.openProject(projectId);
      });
    });
  }

  openProject(projectId) {
    console.log("Opening project:", projectId);
    this.currentProject = projectId;
    this.projectData = this.allProjects[projectId];

    if (!this.projectData) {
      console.error("Project data not found for:", projectId);
      return;
    }

    window.uiManager.updateProjectHeader(this.projectData);
    this.renderTodos();

    eventBus.emit("project:loaded", this.projectData);
  }

  loadProjectData(project, data) {
    this.currentProject = project;
    this.projectData = data || {
      todos: [],
      chatHistory: [],
      title: project,
      techStack: ["React", "Vite", "TypeScript"],
      createdAt: new Date().toISOString(),
    };

    window.uiManager.updateProjectHeader(this.projectData);
    this.renderTodos();

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

    if (!titleInput || !descriptionInput) {
      console.error("Form inputs not found");
      return;
    }

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    console.log("Form data:", { title, description });

    if (!title) {
      alert("Please enter a project title");
      return;
    }

    // Create consistent project ID based on title and timestamp
    const timestamp = Date.now();
    const projectId = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")}-${timestamp}`;

    // Use standard Bolt tech stack
    const projectData = {
      title,
      description,
      techStack: ["React", "Vite", "TypeScript", "Tailwind"],
      todos: [],
      chatHistory: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    console.log(
      "Creating project with ID:",
      projectId,
      "and data:",
      projectData
    );

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

    // Set as current project BEFORE saving to prevent duplicates
    this.currentProject = projectId;
    this.projectData = projectData;
    this.allProjects[projectId] = projectData;

    // Save the project
    this.saveProjectData();

    // Close modal
    window.uiManager.hideModal();

    console.log("Project created successfully");
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
               data-todo-id="${todo.id}"
               class="todo-checkbox">
        <span class="todo-text">${CoreUtils.escapeHtml(todo.text)}</span>
        <div class="todo-actions">
          <button data-todo-id="${todo.id}" 
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

    // Add event listeners using event delegation
    this.setupTodoEventListeners();
  }

  setupTodoEventListeners() {
    // Remove existing listeners to prevent duplicates
    if (this.handleTodoToggle) {
      this.todosList.removeEventListener("change", this.handleTodoToggle);
    }
    if (this.handleTodoDelete) {
      this.todosList.removeEventListener("click", this.handleTodoDelete);
    }

    // Add event listeners for checkboxes (toggle)
    this.handleTodoToggle = (e) => {
      if (e.target.classList.contains("todo-checkbox")) {
        const todoId = e.target.getAttribute("data-todo-id");
        if (todoId) {
          console.log("Toggling todo:", todoId);
          this.toggleTodo(todoId);
        }
      }
    };

    // Add event listeners for delete buttons
    this.handleTodoDelete = (e) => {
      if (e.target.closest(".delete-btn")) {
        const todoId = e.target
          .closest(".delete-btn")
          .getAttribute("data-todo-id");
        if (todoId) {
          console.log("Deleting todo:", todoId);
          this.deleteTodo(todoId);
        }
      }
    };

    // Use event delegation
    this.todosList.addEventListener("change", this.handleTodoToggle);
    this.todosList.addEventListener("click", this.handleTodoDelete);
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

    // Clear any existing save timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves to prevent duplicates during rapid AI function calls
    this.saveTimeout = setTimeout(() => {
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

      console.log(`Project ${this.currentProject} saved successfully`);
    }, 100); // 100ms debounce
  }
}

// Make ProjectManager globally available
window.ProjectManager = ProjectManager;
