class ChatManager {
  constructor() {
    this.isTyping = false;

    this.initElements();
    this.setupEventListeners();
  }

  initElements() {
    this.chatMessages = document.getElementById("chatMessages");
    this.chatInput = document.getElementById("chatInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.typingIndicator = document.getElementById("typingIndicator");
  }

  setupEventListeners() {
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.chatInput.addEventListener("input", () => this.handleInputResize());

    eventBus.on("project:loaded", (projectData) =>
      this.renderChatHistory(projectData)
    );
    eventBus.on("chat:cleared", () => this.clearChatDisplay());
    eventBus.on("tab:changed", (tab) => {
      if (tab === "chat") {
        this.scrollToBottom();
      }
    });

    window.addEventListener("message", (event) => {
      const { type, response, error, functionCalls } = event.data;

      if (type === "OPENAI_RESPONSE") {
        this.handleAIResponse(response, error, functionCalls);
      }
    });
  }

  handleInputResize() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height =
      Math.min(this.chatInput.scrollHeight, 120) + "px";
  }

  sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || this.isTyping) return;

    this.addMessageToChat("user", message);
    this.chatInput.value = "";
    this.handleInputResize();
    this.showTyping();

    const projectData = window.projectManager?.projectData;
    const context = {
      project: window.projectManager?.currentProject,
      todos: projectData?.todos || [],
      chatHistory: (projectData?.chatHistory || []).slice(-10),
      projectData: projectData,
    };

    window.parent.postMessage(
      {
        type: "SEND_MESSAGE",
        data: { message, context },
      },
      "*"
    );
  }

  handleAIResponse(response, error, functionCalls) {
    this.hideTyping();

    if (error) {
      this.addMessageToChat("system", `Error: ${error}`);
      return;
    }

    if (functionCalls && functionCalls.length > 0) {
      functionCalls.forEach((call) => {
        eventBus.emit("ai:function", call);
      });
    }

    if (response) {
      this.addMessageToChat("ai", response);
    }
  }

  addMessageToChat(role, content) {
    const message = {
      id: CoreUtils.generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    const projectData = window.projectManager?.projectData;
    if (projectData) {
      if (!projectData.chatHistory) {
        projectData.chatHistory = [];
      }
      projectData.chatHistory.push(message);
      window.projectManager?.saveProjectData();
    }

    this.renderMessage(message);
    this.scrollToBottom();
  }

  renderMessage(message) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${message.role}-message flex mb-4`;

    const time = CoreUtils.formatTime(message.timestamp);
    const formattedContent = this.formatMessageContent(message.content);

    let messageContent = "";

    if (message.role === "user") {
      messageEl.className += " justify-end";
      messageContent = `
        <div class="max-w-[85%]">
          <div class="message-content">
            <p>${formattedContent}</p>
          </div>
          <div class="message-timestamp">${time}</div>
        </div>
      `;
    } else if (message.role === "ai") {
      messageEl.className += " justify-start";
      messageContent = `
        <div class="max-w-[85%]">
          <div class="message-content">
            <p>${formattedContent}</p>
          </div>
          <div class="message-timestamp">${time}</div>
        </div>
      `;
    } else if (message.role === "system") {
      messageEl.className += " justify-center";
      messageContent = `
        <div>
          <div class="message-content">
            <p>${formattedContent}</p>
          </div>
          <div class="message-timestamp" style="text-align: center;">${time}</div>
        </div>
      `;
    }

    messageEl.innerHTML = messageContent;
    this.chatMessages.appendChild(messageEl);
  }

  formatMessageContent(content) {
    return CoreUtils.escapeHtml(content)
      .replace(/\n/g, "<br>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  renderChatHistory(projectData) {
    const systemMessage = this.chatMessages.querySelector(".system-message");
    this.chatMessages.innerHTML = "";

    if (systemMessage) {
      this.chatMessages.appendChild(systemMessage);
    } else {
      const defaultSystemMessage = document.createElement("div");
      defaultSystemMessage.className =
        "message system-message flex justify-center mb-4";
      defaultSystemMessage.innerHTML = `
        <div class="max-w-[90%]">
          <div class="message-content">
            <p>🥜 Welcome to <strong>Nuts for Bolt</strong></p>
            <p style="margin-top: 12px; font-size: 14px; opacity: 0.9;">I can help you manage tasks with full CRUD operations, perform bulk actions, answer questions about your project, and provide development guidance. Try asking me to <em>"add a task"</em>, <em>"complete all pending tasks"</em>, or <em>"delete completed tasks"</em>!</p>
            <p style="margin-top: 8px; font-size: 13px; opacity: 0.8;">💡 <strong>Pro tip:</strong> Once your tasks are ready, use the Automation tab to run autopilot mode and build your app automatically!</p>
          </div>
        </div>
      `;
      this.chatMessages.appendChild(defaultSystemMessage);
    }

    if (projectData?.chatHistory) {
      if (projectData.chatHistory[0].role === "user") {
        projectData.chatHistory.shift();
      }

      projectData.chatHistory.forEach((message) => {
        this.renderMessage(message);
      });
    }

    this.scrollToBottom();
  }

  showTyping() {
    this.isTyping = true;
    this.typingIndicator.classList.remove("hidden");
    this.sendBtn.disabled = true;
    this.sendBtn.style.opacity = "0.5";
  }

  hideTyping() {
    this.isTyping = false;
    this.typingIndicator.classList.add("hidden");
    this.sendBtn.disabled = false;
    this.sendBtn.style.opacity = "1";
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }, 100);
  }

  clearChat() {
    if (confirm("Are you sure you want to clear the chat history?")) {
      const projectData = window.projectManager?.projectData;
      if (projectData) {
        projectData.chatHistory = [];
        window.projectManager?.saveProjectData();
      }
      this.clearChatDisplay();
    }
  }

  clearChatDisplay() {
    const systemMessage = this.chatMessages.querySelector(".system-message");
    this.chatMessages.innerHTML = "";

    if (systemMessage) {
      this.chatMessages.appendChild(systemMessage);
    }
  }
}

window.ChatManager = ChatManager;
