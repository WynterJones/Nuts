// Chat Manager - handles AI conversations and message display
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
    this.clearChatBtn = document.getElementById("clearChatBtn");
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
    this.clearChatBtn.addEventListener("click", () => this.clearChat());

    // Listen to events
    eventBus.on("project:loaded", (projectData) =>
      this.renderChatHistory(projectData)
    );
    eventBus.on("chat:cleared", () => this.clearChatDisplay());
    eventBus.on("tab:changed", (tab) => {
      if (tab === "chat") {
        this.scrollToBottom();
      }
    });

    // Message listener for AI responses
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

    // Get current project data for context
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

    // Handle function calls from AI
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

    // Add to project data
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
          <div class="bg-nuts text-black rounded-xl px-4 py-3 rounded-br-md">
            <p class="text-sm font-medium">${formattedContent}</p>
          </div>
          <div class="text-xs text-gray-500 mt-1 text-right">${time}</div>
        </div>
      `;
    } else if (message.role === "ai") {
      messageEl.className += " justify-start";
      messageContent = `
        <div class="max-w-[85%]">
          <div class="bg-gray-950 text-white border border-gray-800 rounded-xl px-4 py-3 rounded-bl-md">
            <p class="text-sm">${formattedContent}</p>
          </div>
          <div class="text-xs text-gray-500 mt-1">${time}</div>
        </div>
      `;
    } else if (message.role === "system") {
      messageEl.className += " justify-center";
      messageContent = `
        <div class="max-w-[90%]">
          <div class="bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 text-center">
            <p class="text-sm">${formattedContent}</p>
          </div>
          <div class="text-xs text-gray-500 mt-1 text-center">${time}</div>
        </div>
      `;
    }

    messageEl.innerHTML = messageContent;
    this.chatMessages.appendChild(messageEl);
  }

  formatMessageContent(content) {
    return CoreUtils.escapeHtml(content)
      .replace(/\n/g, "<br>")
      .replace(
        /`([^`]+)`/g,
        '<code class="bg-gray-700 px-1 py-0.5 rounded text-xs">$1</code>'
      )
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  renderChatHistory(projectData) {
    // Clear messages except system message
    const systemMessage = this.chatMessages.querySelector(".system-message");
    this.chatMessages.innerHTML = "";

    // Re-add system message
    if (systemMessage) {
      this.chatMessages.appendChild(systemMessage);
    } else {
      // Create default system message if it doesn't exist
      const defaultSystemMessage = document.createElement("div");
      defaultSystemMessage.className =
        "message system-message flex justify-center mb-4";
      defaultSystemMessage.innerHTML = `
        <div class="max-w-[90%]">
          <div class="bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 text-center">
            <p class="text-sm">Hello! I'm Nuts for Bolt, your AI agent. I can help you manage tasks, answer questions about your project, and provide development guidance. Try asking me to "add a task" or "complete the first task"!</p>
          </div>
        </div>
      `;
      this.chatMessages.appendChild(defaultSystemMessage);
    }

    // Render chat history
    if (projectData?.chatHistory) {
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
    // Keep only the system message
    const systemMessage = this.chatMessages.querySelector(".system-message");
    this.chatMessages.innerHTML = "";

    if (systemMessage) {
      this.chatMessages.appendChild(systemMessage);
    }
  }
}

// Make ChatManager globally available
window.ChatManager = ChatManager;
