let assistantIframe = null;
let currentProject = null;
let isButtonInjected = false;

function createButton() {
  console.log("Creating Nuts for Bolt button...");
  const button = document.createElement("button");
  button.id = "bolt-assistant-btn";
  button.className = `flex items-center text-bolt-elements-item-contentDefault bg-transparent rounded-md 
    disabled:cursor-not-allowed enabled:hover:text-bolt-elements-item-contentActive 
    enabled:hover:bg-bolt-elements-item-backgroundActive p-1`;
  button.setAttribute("aria-label", "Open Nuts for Bolt Assistant");
  button.setAttribute("data-state", "closed");

  button.innerHTML = `
   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
     <path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12q0 .531.054 1.048C2.404 13.352 4.367 15 6 15c1.212 0 2.606-.908 3.387-1.5l.01-.009a3 3 0 1 1 4.61.739c.47.412 1.084.77 1.798.77c1.69 0 1.69-2 3.38-2c1.077 0 1.925.814 2.399 1.403l.092.132c.211-.81.324-1.659.324-2.535c0-5.523-4.477-10-10-10" opacity="0.5"/>
     <path fill="currentColor" d="M9.388 13.5C8.607 14.092 7.212 15 6 15c-1.633 0-3.596-1.648-3.945-1.952C2.579 18.078 6.832 22 12 22c4.647 0 8.554-3.17 9.676-7.465l-.092-.132c-.473-.59-1.322-1.403-2.4-1.403c-1.689 0-1.689 2-3.378 2c-.714 0-1.328-.357-1.798-.77a3 3 0 0 1-4.61-.739zm10.14-8.083l-.058.053l-1 1a.75.75 0 1 0 1.06 1.06l.905-.904q-.409-.64-.907-1.209M5.417 4.472q.025.03.053.058l1 1a.75.75 0 0 0 1.06-1.06l-.904-.905q-.64.41-1.209.907m5.053.058a.75.75 0 1 1 1.06-1.06l1 1a.75.75 0 1 1-1.06 1.06zm6.13.92a.75.75 0 1 0-1.2-.9l-1.5 2a.75.75 0 0 0 1.2.9zM8.41 7.56a.75.75 0 0 0 .918.53l1.366-.366a.75.75 0 1 0-.388-1.448l-1.366.366a.75.75 0 0 0-.53.918m9.056 2.794a.75.75 0 1 1-1.499.07l-.066-1.412a.75.75 0 0 1 1.498-.07zm.971 1.705a.75.75 0 0 0 1.059.067l1.678-1.478a.75.75 0 1 0-.992-1.126L18.504 11a.75.75 0 0 0-.067 1.059M5.525 8.167a.75.75 0 1 1 1.365-.62l.585 1.286a.75.75 0 1 1-1.365.621z"/>
     <path fill="currentColor" d="M6.943 10.895a.75.75 0 0 1 .162 1.048l-.835 1.141a.75.75 0 1 1-1.21-.886l.835-1.14a.75.75 0 0 1 1.048-.163M2.856 8.98a.75.75 0 0 1 1.497-.084l.079 1.412a.75.75 0 0 1-1.498.083z"/>
   </svg>
  `;

  button.addEventListener("click", () => {
    console.log("Nuts for Bolt button clicked!");
    toggleAssistant();
  });

  console.log("Button created successfully");
  return button;
}

function injectButton() {
  if (isButtonInjected) return;

  console.log("Attempting to inject button...");

  const targetSelector =
    ".bg-bolt-elements-prompt-background .text-bolt-elements-item-contentDefault";
  const targetElement = document.querySelector(targetSelector);

  if (targetElement && targetElement.parentElement) {
    console.log("Target element found, injecting button");
    const button = createButton();
    targetElement.parentElement.appendChild(button);
    isButtonInjected = true;
    console.log("Button injected successfully");
  } else {
    console.log("Target element not found, retrying...");
    setTimeout(injectButton, 1000);
  }
}

function toggleAssistant() {
  console.log("Toggle assistant called");

  if (assistantIframe) {
    closeAssistant();
  } else {
    openAssistant();
  }
}

function openAssistant() {
  console.log("Opening assistant");

  assistantIframe = document.createElement("iframe");
  assistantIframe.src = chrome.runtime.getURL("iframe.html");
  assistantIframe.className = "nuts-assistant-iframe";
  assistantIframe.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    width: 400px;
    height: 600px;
    border: 1px solid #333;
    border-radius: 12px;
    background: #000;
    z-index: 999999;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  `;

  document.body.appendChild(assistantIframe);

  detectProjectChange();
}

function closeAssistant() {
  console.log("Closing assistant");

  if (assistantIframe) {
    assistantIframe.remove();
    assistantIframe = null;
  }
}

function detectProjectChange() {
  const url = window.location.href;
  const projectMatch = url.match(/bolt\.new\/([^\/\?]+)/);
  const newProject = projectMatch ? projectMatch[1] : "default";

  if (newProject !== currentProject) {
    console.log("Project changed:", newProject);
    currentProject = newProject;
    loadProjectData(newProject);
  }
}

async function loadProjectData(projectId) {
  try {
    const result = await chrome.storage.local.get([`project_${projectId}`]);
    const projectData = result[`project_${projectId}`] || {
      todos: [],
      chatHistory: [],
      automations: [],
      title: projectId,
      techStack: ["React", "Vite"],
      createdAt: new Date().toISOString(),
    };

    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "PROJECT_DATA",
          project: projectId,
          data: projectData,
        },
        "*"
      );
    }
  } catch (error) {
    console.error("Error loading project data:", error);
  }
}

async function saveProjectData(projectData) {
  if (!currentProject) return;

  try {
    projectData.lastUpdated = new Date().toISOString();
    await chrome.storage.local.set({
      [`project_${currentProject}`]: projectData,
    });
    console.log("Project data saved successfully");
  } catch (error) {
    console.error("Error saving project data:", error);
  }
}

// Message listener for iframe communication
window.addEventListener("message", (event) => {
  if (!assistantIframe) return;

  const { type, data } = event.data;
  console.log("Received message:", type, data);

  switch (type) {
    case "CLOSE_IFRAME":
      closeAssistant();
      break;

    case "SAVE_PROJECT_DATA":
      saveProjectData(data);
      break;

    case "SEND_MESSAGE":
      handleChatMessage(data.message, data.context);
      break;

    case "GENERATE_TASKS_FROM_DESCRIPTION":
      handleTaskGeneration(data);
      break;

    case "MOVE_IFRAME":
      if (assistantIframe) {
        const currentRect = assistantIframe.getBoundingClientRect();
        const newX = Math.max(
          0,
          Math.min(
            window.innerWidth - currentRect.width,
            currentRect.left + data.deltaX
          )
        );
        const newY = Math.max(
          0,
          Math.min(
            window.innerHeight - currentRect.height,
            currentRect.top + data.deltaY
          )
        );

        assistantIframe.style.left = newX + "px";
        assistantIframe.style.top = newY + "px";
        assistantIframe.style.right = "auto";

        console.log("Iframe moved to:", { x: newX, y: newY });
      }
      break;
  }
});

async function handleChatMessage(message, context) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "OPENAI_REQUEST",
      message: message,
      context: context,
    });

    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "OPENAI_RESPONSE",
          response: response.content,
          error: response.error,
          functionCalls: response.functionCalls,
        },
        "*"
      );
    }
  } catch (error) {
    console.error("Error sending chat message:", error);

    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "OPENAI_RESPONSE",
          response: null,
          error: "Failed to send message",
        },
        "*"
      );
    }
  }
}

async function handleTaskGeneration(data) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_TASKS",
      projectData: data.projectData,
      description: data.description,
    });

    if (response.updatedProjectData) {
      await saveProjectData(response.updatedProjectData);

      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "PROJECT_DATA",
            project: data.projectId,
            data: response.updatedProjectData,
          },
          "*"
        );
      }
    }
  } catch (error) {
    console.error("Error generating tasks:", error);
  }
}

// URL change detection
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    detectProjectChange();
  }
}).observe(document, { subtree: true, childList: true });

// Initialize
setTimeout(() => {
  console.log("Initializing Nuts for Bolt assistant...");
  injectButton();
}, 1000);

console.log("Nuts for Bolt content script loaded");
