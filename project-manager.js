class ProjectManager {
  constructor() {
    this.currentProject = null;
    this.projectData = null;
    this.allProjects = {};
    this.saveTimeout = null;
    this.dragListenersAdded = false;

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

    this.addTodoBtn.addEventListener("click", () => this.showTodoInput());
    this.saveTodoBtn.addEventListener("click", () => this.saveTodo());
    this.cancelTodoBtn.addEventListener("click", () => this.hideTodoInput());
    this.todoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.saveTodo();
    });

    eventBus.on("view:projectList", () => this.loadAllProjects());
    eventBus.on("clear:tab", (tab) => this.clearTabData(tab));
    eventBus.on("project:delete", () => this.deleteCurrentProject());
    eventBus.on("ai:function", (data) => this.handleAIFunction(data));

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
        case "TASK_GENERATION_COMPLETE":
          if (
            event.data.projectData &&
            this.currentProject &&
            this.projectData
          ) {
            if (event.data.projectData.todos) {
              this.projectData.todos = [
                ...this.projectData.todos,
                ...event.data.projectData.todos,
              ];
            }

            if (event.data.projectData.chatHistory) {
              const existingChatIds = new Set(
                this.projectData.chatHistory.map((m) => m.id)
              );
              const newChatEntries = event.data.projectData.chatHistory.filter(
                (m) => !existingChatIds.has(m.id)
              );
              this.projectData.chatHistory = [
                ...this.projectData.chatHistory,
                ...newChatEntries,
              ];
            }

            if (event.data.projectData.settings) {
              this.projectData.settings = {
                ...this.projectData.settings,
                ...event.data.projectData.settings,
              };
            }

            this.projectData.lastUpdated = new Date().toISOString();

            this.allProjects[this.currentProject] = this.projectData;

            this.saveProjectData();

            if (window.settingsManager) {
              window.settingsManager.refreshSettings();
            }

            eventBus.emit("tasks:updated", this.projectData.todos);

            this.finalizeProjectCreation(this.currentProject, this.projectData);
          } else {
            console.warn(
              "Task generation completed but project data is missing or invalid"
            );
            this.hideProcessingState();
          }
          break;
        case "TASK_GENERATION_ERROR":
          console.error("Task generation failed:", event.data.error);
          this.hideProcessingState();
          alert("Failed to generate tasks: " + event.data.error);
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
          const projectData = allData[key];

          if (this.isValidProject(projectId, projectData)) {
            if (!projectData.settings) {
              projectData.settings = {
                starterPrompt:
                  "Build me a basic web app for react, vite, supabase app.",
                appendPrompt: "",
                waitTime: 120000,
              };

              StorageManager.set(`project_${projectId}`, projectData);
            }

            this.allProjects[projectId] = projectData;
          } else {
            this.cleanupInvalidProject(key, projectId);
          }
        }
      });

      this.renderProjectList();
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }

  isValidProject(projectId, projectData) {
    if (!projectData || typeof projectData !== "object") {
      return false;
    }

    if (!projectId || projectId.length < 5) {
      return false;
    }

    const invalidIds = ["~", "default", "undefined", "null", "test"];
    if (invalidIds.includes(projectId)) {
      return false;
    }

    const requiredFields = ["createdAt"];
    for (const field of requiredFields) {
      if (!projectData[field]) {
        return false;
      }
    }

    if (projectData.todos && !Array.isArray(projectData.todos)) {
      return false;
    }

    if (projectData.chatHistory && !Array.isArray(projectData.chatHistory)) {
      return false;
    }

    if (projectData.title && typeof projectData.title !== "string") {
      return false;
    }

    return true;
  }

  async cleanupInvalidProject(storageKey, projectId) {
    try {
      const veryInvalidIds = ["~", "", "undefined", "null"];

      if (veryInvalidIds.includes(projectId)) {
        await StorageManager.remove(storageKey);
      }
    } catch (error) {
      console.error(`Error cleaning up invalid project ${storageKey}:`, error);
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

    const sortedProjectKeys = projectKeys.sort((a, b) => {
      const projectA = this.allProjects[a];
      const projectB = this.allProjects[b];
      const dateA = new Date(projectA.createdAt);
      const dateB = new Date(projectB.createdAt);
      return dateB - dateA;
    });

    const projectCards = sortedProjectKeys
      .map((projectId) => {
        const project = this.allProjects[projectId];
        const todoCount = project.todos?.length || 0;
        const chatCount = project.chatHistory?.length || 0;
        const completedTodos =
          project.todos?.filter((t) => t.completed).length || 0;
        const createdDate = CoreUtils.formatDate(project.createdAt);
        const title = project.title || projectId;
        return `
        <div class="project-card" data-project-id="${projectId}">
          <h4>${CoreUtils.escapeHtml(title)}</h4>
          <div class="project-meta">Created: ${createdDate}</div>
          <div class="project-stats">
            <span>Tasks: ${completedTodos}/${todoCount}</span>
          </div>
        </div>
      `;
      })
      .join("");

    this.projectsGrid.innerHTML = `<div class="grid">${projectCards}</div>`;

    this.setupProjectClickListeners();
  }

  setupProjectClickListeners() {
    const projectCards = this.projectsGrid.querySelectorAll(".project-card");
    projectCards.forEach((card) => {
      card.addEventListener("click", () => {
        const projectId = card.getAttribute("data-project-id");
        this.openProject(projectId);
      });
    });
  }

  openProject(projectId) {
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
            <label>Braindump</label>
            <textarea id="newProjectDescription" rows="4" placeholder="Explain your ideas here and they will be turned into a web app task list by Nuts AI. Describe features, user stories, technical requirements, or anything else about your project..."></textarea>
          </div>
          <div class="form-group">
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" id="useSupabase" checked>
                <span class="checkmark"></span>
                <span class="checkbox-title">Supabase Database / Authentication</span>
              </label>
              <p class="checkbox-description">Include database setup, user authentication, and Supabase functions.</p>
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

    modal.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.remove();
      });
    });

    const createBtn = modal.querySelector("#createProjectBtn");
    createBtn.addEventListener("click", () => {
      this.createNewProject();
    });

    setTimeout(() => {
      const titleInput = document.getElementById("newProjectTitle");
      if (titleInput) titleInput.focus();
    }, 100);
  }

  createNewProject() {
    const titleInput = document.getElementById("newProjectTitle");
    const descriptionInput = document.getElementById("newProjectDescription");
    const useSupabaseInput = document.getElementById("useSupabase");

    if (!titleInput || !descriptionInput || !useSupabaseInput) {
      console.error("Form inputs not found");
      return;
    }

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const useSupabase = useSupabaseInput.checked;

    if (!title) {
      alert("Please enter a project title");
      return;
    }

    const existingProject = Object.values(this.allProjects).find(
      (project) =>
        project.title && project.title.toLowerCase() === title.toLowerCase()
    );

    if (existingProject) {
      const proceed = confirm(
        `A project named "${title}" already exists. Create anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    this.showProcessingState();

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const projectId = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")}-${timestamp}-${randomSuffix}`;

    const techStack = ["React", "Vite", "TypeScript", "Tailwind"];
    if (useSupabase) {
      techStack.push("Supabase");
    }
    techStack.push("Netlify");

    const defaultStarterPrompt = useSupabase
      ? `Build me a ${title.toLowerCase()} using React, Vite, TypeScript, Tailwind CSS, and Supabase. Include user authentication and database functionality.`
      : `Build me a ${title.toLowerCase()} using React, Vite, TypeScript, and Tailwind CSS as a client-side application.`;

    const projectData = {
      title,
      description,
      techStack,
      useSupabase,
      todos: [],
      chatHistory: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      settings: {
        starterPrompt: defaultStarterPrompt,
        appendPrompt: "",
        waitTime: 120000,
      },
    };

    if (this.allProjects[projectId]) {
      console.warn("Project already exists, skipping creation:", projectId);
      return;
    }

    this.currentProject = projectId;
    this.projectData = projectData;
    this.allProjects[projectId] = projectData;

    if (description) {
      projectData.chatHistory.push({
        id: CoreUtils.generateId(),
        role: "user",
        content: `New project: ${title}\n\nDescription: ${description}`,
        timestamp: new Date().toISOString(),
      });

      this.saveProjectData();

      window.parent.postMessage(
        {
          type: "GENERATE_TASKS_FROM_DESCRIPTION",
          data: { projectId, projectData, description, useSupabase },
        },
        "*"
      );
    } else {
      this.saveProjectData();
      this.finalizeProjectCreation(projectId, projectData);
    }
  }

  showProcessingState() {
    const createBtn = document.getElementById("createProjectBtn");
    const cancelBtn = document.querySelector(".cancel-btn");
    const modalBody = document.querySelector(".modal-body");
    const modalFooter = document.querySelector(".modal-footer");
    const formGroups = document.querySelectorAll(".form-group");
    const modalHeader = document.querySelector(".modal-header");

    formGroups.forEach((group) => {
      group.style.display = "none";
    });

    if (modalFooter) {
      modalFooter.style.display = "none";
    }

    if (modalHeader) {
      modalHeader.style.display = "none";
    }

    if (modalBody) {
      const processingDiv = document.createElement("div");
      processingDiv.id = "processingMessage";
      processingDiv.className = "processing-message";
      processingDiv.innerHTML = `
        <div class="processing-content">
          <div class="processing-spinner"></div>
          <p>Nuts AI is generating your project...</p>
          <p class="processing-subtext">This may take a few seconds</p>
        </div>
      `;
      modalBody.appendChild(processingDiv);
    }
  }

  hideProcessingState() {
    const createBtn = document.getElementById("createProjectBtn");
    const processingMessage = document.getElementById("processingMessage");
    const modalFooter = document.querySelector(".modal-footer");
    const formGroups = document.querySelectorAll(".form-group");

    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = "Create Project";
    }

    if (modalFooter) {
      modalFooter.style.display = "flex";
    }

    formGroups.forEach((group) => {
      group.style.display = "block";
    });

    if (processingMessage) {
      processingMessage.remove();
    }
  }

  finalizeProjectCreation(projectId, projectData) {
    this.hideProcessingState();

    window.uiManager.hideModal();

    this.openProject(projectId);

    eventBus.emit("project:created", projectData);
  }

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
      sortOrder: this.projectData.todos.length,
    };

    this.projectData.todos.push(todo);
    this.saveProjectData();
    this.renderTodos();
    this.hideTodoInput();

    eventBus.emit("tasks:updated", this.projectData.todos);
  }

  toggleTodo(id) {
    const task = this.projectData.todos.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.updatedAt = new Date().toISOString();
      this.saveProjectData();
      this.renderTodos();

      eventBus.emit("tasks:updated", this.projectData.todos);
    }
  }

  deleteTodo(id) {
    this.projectData.todos = this.projectData.todos.filter((t) => t.id !== id);
    this.saveProjectData();
    this.renderTodos();

    eventBus.emit("tasks:updated", this.projectData.todos);
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

    this.projectData.todos.forEach((task, index) => {
      if (task.sortOrder === undefined) {
        task.sortOrder = index;
      }
    });

    const sortedTodos = [...this.projectData.todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    this.todosList.innerHTML = "";
    sortedTodos.forEach((task) => {
      const todoItem = this.createTodoItemElement(task);
      this.todosList.appendChild(todoItem);
    });

    if (!this.dragListenersAdded) {
      this.addDragAndDropListeners();
      this.dragListenersAdded = true;
    }

    const emptyState = this.todosList.querySelector(".empty-state");
    if (emptyState) {
      if (this.projectData.todos.length > 0) {
        emptyState.remove();
      }
    }
  }

  createTodoItemElement(task) {
    const todoItem = document.createElement("div");
    todoItem.className = `todo-item ${task.completed ? "completed" : ""}`;
    todoItem.dataset.id = task.id;
    todoItem.draggable = true;

    todoItem.innerHTML = `
      <div class="todo-checkbox-container">
        <input type="checkbox" class="todo-checkbox" ${
          task.completed ? "checked" : ""
        }>
        <span class="checkmark"></span>
      </div>
      <span class="todo-text">${CoreUtils.escapeHtml(task.text)}</span>
      <div class="todo-actions">
        <span class="drag-handle">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M5 15q-.425 0-.712-.288T4 14t.288-.712T5 13h14q.425 0 .713.288T20 14t-.288.713T19 15zm0-4q-.425 0-.712-.288T4 10t.288-.712T5 9h14q.425 0 .713.288T20 10t-.288.713T19 11z"/></svg>
        </span>
        <button class="delete-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m18 9l-.84 8.398c-.127 1.273-.19 1.909-.48 2.39a2.5 2.5 0 0 1-1.075.973C15.098 21 14.46 21 13.18 21h-2.36c-1.279 0-1.918 0-2.425-.24a2.5 2.5 0 0 1-1.076-.973c-.288-.48-.352-1.116-.48-2.389L6 9m7.5 6.5v-5m-3 5v-5m-6-4h4.615m0 0l.386-2.672c.112-.486.516-.828.98-.828h3.038c.464 0 .867.342.98.828l.386 2.672m-5.77 0h5.77m0 0H19.5"/></svg>
        </button>
      </div>
    `;

    const checkbox = todoItem.querySelector(".todo-checkbox");
    const checkboxContainer = todoItem.querySelector(
      ".todo-checkbox-container"
    );
    const deleteBtn = todoItem.querySelector(".delete-btn");
    const todoText = todoItem.querySelector(".todo-text");

    checkboxContainer.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
      this.toggleTodo(task.id);
    });

    deleteBtn.addEventListener("click", () => this.deleteTodo(task.id));
    todoText.addEventListener("click", () =>
      this.enterEditMode(todoText, task)
    );

    return todoItem;
  }

  enterEditMode(todoTextElement, task) {
    const existingTextarea = document.querySelector(".todo-edit-textarea");
    if (existingTextarea) {
      existingTextarea.blur();
    }

    const currentText = task.text;
    const todoItem = todoTextElement.closest(".todo-item");

    const textarea = document.createElement("textarea");
    textarea.value = currentText;
    textarea.className = "todo-edit-textarea";
    textarea.rows = Math.max(2, Math.ceil(currentText.length / 50));

    todoTextElement.replaceWith(textarea);
    textarea.focus();
    textarea.select();

    const autoResize = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    autoResize();

    const saveAndExit = () => {
      const newText = textarea.value.trim();
      if (newText && newText !== currentText) {
        task.text = newText;
        this.saveProjectData();
        eventBus.emit("tasks:updated", this.projectData.todos);
      }

      this.renderTodos();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        textarea.blur();
      } else if (e.key === "Escape") {
        this.renderTodos();
      }
    };

    textarea.addEventListener("blur", saveAndExit);
    textarea.addEventListener("keydown", handleKeyDown);
    textarea.addEventListener("input", autoResize);
  }

  addDragAndDropListeners() {
    let draggedItem = null;

    this.todosList.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("todo-item")) {
        draggedItem = e.target;
        setTimeout(() => {
          draggedItem.classList.add("dragging");
        }, 0);
      }
    });

    this.todosList.addEventListener("dragend", (e) => {
      if (draggedItem) {
        draggedItem.classList.remove("dragging");
        draggedItem = null;
      }
    });

    this.todosList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = this.getDragAfterElement(e.clientY);
      const currentItem = document.querySelector(".dragging");
      if (currentItem) {
        if (afterElement == null) {
          this.todosList.appendChild(currentItem);
        } else {
          this.todosList.insertBefore(currentItem, afterElement);
        }
      }
    });

    this.todosList.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedItem) return;

      const newOrderIds = Array.from(
        this.todosList.querySelectorAll(".todo-item")
      ).map((item) => item.dataset.id);

      const incompleteTasks = this.projectData.todos.filter(
        (t) => !t.completed
      );
      const incompleteIds = newOrderIds.filter((id) => {
        const task = this.projectData.todos.find((t) => t.id === id);
        return task && !task.completed;
      });

      incompleteIds.forEach((id, index) => {
        const task = this.projectData.todos.find((t) => t.id === id);
        if (task) {
          task.sortOrder = index;
        }
      });

      const completedTasks = this.projectData.todos.filter((t) => t.completed);
      completedTasks.forEach((task, index) => {
        task.sortOrder = incompleteIds.length + index;
      });

      this.saveProjectData();

      this.renderTodos();

      eventBus.emit("tasks:updated", this.projectData.todos);
    });
  }

  getDragAfterElement(y) {
    const draggableElements = [
      ...this.todosList.querySelectorAll(".todo-item:not(.dragging)"),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

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

    eventBus.emit("tasks:updated", this.projectData.todos);
  }

  addTaskFromAI(taskText, priority = "normal") {
    const todo = {
      id: CoreUtils.generateId(),
      text: taskText,
      completed: false,
      priority,
      createdAt: new Date().toISOString(),
      createdBy: "ai",
      sortOrder: this.projectData.todos.length,
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
    if (!this.currentProject || !this.projectData) {
      console.warn(
        "Cannot save project data - missing currentProject or projectData"
      );
      return;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        this.projectData.lastUpdated = new Date().toISOString();

        const success = await StorageManager.set(
          `project_${this.currentProject}`,
          this.projectData
        );

        window.parent.postMessage(
          {
            type: "SAVE_PROJECT_DATA",
            data: this.projectData,
          },
          "*"
        );
      } catch (error) {
        console.error("Error saving project data:", error);
      }
    }, 100);
  }
}

window.ProjectManager = ProjectManager;
