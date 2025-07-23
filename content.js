let assistantIframe = null;
let currentProject = null;
let isButtonInjected = false;

function createButton() {
  const button = document.createElement("button");
  button.id = "bolt-assistant-btn";
  button.className = `flex items-center text-bolt-elements-item-contentDefault bg-transparent rounded-md 
    disabled:cursor-not-allowed enabled:hover:text-bolt-elements-item-contentActive 
    enabled:hover:bg-bolt-elements-item-backgroundActive p-1`;
  button.setAttribute("aria-label", "Open Nuts for Bolt Assistant");
  button.setAttribute("data-state", "closed");

  button.innerHTML = `
   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><g fill="currentColor"><path d="m219.84 73.16l-88-48.16a8 8 0 0 0-7.68 0l-88 48.18a8 8 0 0 0-4.16 7v95.64a8 8 0 0 0 4.16 7l88 48.18a8 8 0 0 0 7.68 0l88-48.18a8 8 0 0 0 4.16-7V80.18a8 8 0 0 0-4.16-7.02M128 168a40 40 0 1 1 40-40a40 40 0 0 1-40 40" opacity="0.2"/><path d="M128 80a48 48 0 1 0 48 48a48.06 48.06 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32m95.68-93.85l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M128 224l-88-48.18V80.18L128 32l88 48.17v95.63Z"/></g></svg>
  `;

  button.addEventListener("click", () => {
    toggleAssistant();
  });

  return button;
}

function injectButton() {
  if (isButtonInjected) return;

  const targetSelector =
    ".bg-bolt-elements-prompt-background .text-bolt-elements-item-contentDefault";
  const targetElement = document.querySelector(targetSelector);

  if (targetElement && targetElement.parentElement) {
    const button = createButton();
    targetElement.parentElement.appendChild(button);
    isButtonInjected = true;
  } else {
    setTimeout(injectButton, 1000);
  }
}

function toggleAssistant() {
  if (assistantIframe) {
    closeAssistant();
  } else {
    openAssistant();
  }
}

function openAssistant() {
  assistantIframe = document.createElement("iframe");
  assistantIframe.src = chrome.runtime.getURL("iframe.html");
  assistantIframe.className = "nuts-assistant-iframe";
  assistantIframe.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    width: 550px;
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
  } catch (error) {
    console.error("Error saving project data:", error);
  }
}

window.addEventListener("message", (event) => {
  if (!assistantIframe) return;

  const { type } = event.data;

  switch (type) {
    case "CLOSE_IFRAME":
      closeAssistant();
      break;

    case "SAVE_PROJECT_DATA":
      saveProjectData(event.data.data);
      break;

    case "SEND_MESSAGE":
      handleChatMessage(event.data.data.message, event.data.data.context);
      break;

    case "GENERATE_TASKS_FROM_DESCRIPTION":
      handleTaskGeneration(event.data.data);
      break;

    case "GET_CURRENT_URL":
      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "CURRENT_URL_RESPONSE",
            url: window.location.href,
          },
          "*"
        );
      }
      break;

    case "RUN_STARTING_SEQUENCE":
      handleStartingSequence(event.data.settings);
      break;

    case "EXECUTE_TASK":
      handleTaskExecution(event.data);
      break;

    case "STOP_AUTOMATION":
      handleStopAutomation();
      break;

    case "MOVE_IFRAME":
      if (assistantIframe) {
        const { deltaX, deltaY } = event.data;
        const rect = assistantIframe.getBoundingClientRect();

        let newLeft = rect.left + deltaX;
        let newTop = rect.top + deltaY;

        const maxLeft = window.innerWidth - assistantIframe.offsetWidth;
        const maxTop = window.innerHeight - assistantIframe.offsetHeight;

        newLeft = Math.max(0, Math.min(maxLeft, newLeft));
        newTop = Math.max(0, Math.min(maxTop, newTop));

        assistantIframe.style.left = `${newLeft}px`;
        assistantIframe.style.top = `${newTop}px`;
        assistantIframe.style.right = "auto";
        assistantIframe.style.bottom = "auto";
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
          response: response?.content || null,
          error: response?.error || null,
          functionCalls: response?.functionCalls || [],
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
          error: error.message || "Failed to send message",
          functionCalls: [],
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
      useSupabase: data.useSupabase,
    });

    if (response?.updatedProjectData) {
      await saveProjectData(response.updatedProjectData);

      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "TASK_GENERATION_COMPLETE",
            project: data.projectId,
            projectData: response.updatedProjectData,
          },
          "*"
        );
      }
    } else if (response?.error) {
      console.error("Task generation failed:", response.error);

      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "TASK_GENERATION_ERROR",
            error: response.error,
          },
          "*"
        );
      }
    }
  } catch (error) {
    console.error("Error generating tasks:", error);

    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "TASK_GENERATION_ERROR",
          error: error.message || "Failed to generate tasks",
        },
        "*"
      );
    }
  }
}

let automationState = {
  isRunning: false,
  currentTask: null,
  retryCount: 0,
  maxRetries: 3,
};

async function handleStartingSequence(settings) {
  automationState.isRunning = true;

  try {
    if (
      window.location.href !== "https://bolt.new" &&
      window.location.href !== "https://bolt.new/"
    ) {
      throw new Error("Starting sequence can only run on https://bolt.new");
    }

    const textarea = document.querySelector(
      ".bg-bolt-elements-prompt-background textarea"
    );

    if (textarea) {
      const starterPrompt =
        settings.starterPrompt ||
        "Build me a basic web app for react, vite, supabase app.";
      await typeText(textarea, starterPrompt);
      textarea.focus();
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
        })
      );
      textarea.dispatchEvent(new Event("change", { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newProjectButton = document.querySelector(
        ".bg-bolt-elements-prompt-background button.absolute"
      );

      if (newProjectButton) {
        newProjectButton.click();
      }
      await waitForCondition(() => {
        return (
          window.location.href !== "https://bolt.new" ||
          document.querySelector(".modal") ||
          document.querySelector('[role="dialog"]')
        );
      }, 5000);

      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "AUTOMATION_STEP_COMPLETE",
            sequenceType: "starting",
          },
          "*"
        );
      }
    } else {
      throw new Error("Could not find starting button on bolt.new");
    }
  } catch (error) {
    console.error("Starting sequence error:", error);
    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "AUTOMATION_ERROR",
          error: error.message,
        },
        "*"
      );
    }
  }

  automationState.isRunning = false;
}

async function handleTaskExecution(data) {
  automationState.isRunning = true;
  automationState.currentTask = data.task;
  automationState.retryCount = 0;

  try {
    await executeTaskInBolt(data);
  } catch (error) {
    console.error("Task execution error:", error);

    const isTimeoutError =
      error.message.includes("Condition not met within") ||
      error.message.includes("timeout");

    if (isTimeoutError) {
      const waitTime = data.settings.waitTime || 180000;
      const waitTimeText =
        waitTime === -1 ? "indefinite wait" : `${waitTime / 1000} seconds`;

      if (assistantIframe) {
        assistantIframe.contentWindow.postMessage(
          {
            type: "AUTOMATION_ERROR",
            error: `Task timed out after ${waitTimeText}. Automation stopped.`,
          },
          "*"
        );
      }
      return;
    }

    if (
      data.settings.autoErrorFix &&
      automationState.retryCount < automationState.maxRetries
    ) {
      automationState.retryCount++;

      setTimeout(() => {
        executeTaskInBolt(data);
      }, 3000);
      return;
    }

    if (assistantIframe) {
      assistantIframe.contentWindow.postMessage(
        {
          type: "AUTOMATION_ERROR",
          error: error.message,
        },
        "*"
      );
    }
  }
}

async function executeTaskInBolt(data) {
  if (data.settings.autoSupabaseMigration) {
    await handleSupabaseMigration();
  }

  if (data.settings.autoErrorFix) {
    await handleErrorFix();
  }

  const promptBox = document.querySelector(
    ".bg-bolt-elements-prompt-background textarea"
  );

  if (!promptBox) {
    throw new Error("Could not find AI prompt box on page");
  }

  await waitForCondition(() => !promptBox.disabled, 10000);

  promptBox.value = "";
  promptBox.focus();

  await typeText(promptBox, data.task.text);

  const submitButton = document.querySelector(
    ".bg-bolt-elements-prompt-background button.absolute"
  );

  if (!submitButton || submitButton.disabled) {
    throw new Error(
      "Submit button (.bg-bolt-elements-prompt-background button.absolute) not found or disabled"
    );
  }

  submitButton.click();

  const waitTime = data.settings.waitTime || 180000;
  const waitTimeText =
    waitTime === -1 ? "indefinitely" : `${waitTime / 1000} seconds`;

  await waitForCondition(
    () => {
      const specificButton = document.querySelector(
        ".bg-bolt-elements-prompt-background button.absolute"
      );
      const isGone = !specificButton;
      if (!isGone) {
      }
      return isGone;
    },
    waitTime === -1 ? Infinity : waitTime
  );

  if (assistantIframe) {
    assistantIframe.contentWindow.postMessage(
      {
        type: "AUTOMATION_STATUS_UPDATE",
        status: "Task completed, moving to next...",
      },
      "*"
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (assistantIframe) {
    assistantIframe.contentWindow.postMessage(
      {
        type: "AUTOMATION_STEP_COMPLETE",
        taskIndex: data.taskIndex,
        totalTasks: data.totalTasks,
        task: data.task,
      },
      "*"
    );
  }

  automationState.currentTask = null;
  automationState.isRunning = false;
}

async function handleSupabaseMigration() {
  const migrationButton = findElementByText(
    "button.bg-bolt-elements-button-supabase-background",
    "Apply changes"
  );

  if (migrationButton && !migrationButton.disabled) {
    migrationButton.click();

    await new Promise((resolve) => setTimeout(resolve, 6000));

    await waitForCondition(
      () =>
        !document.querySelector(
          "button.bg-bolt-elements-button-supabase-background"
        ),
      180000
    );
  }
}

async function handleErrorFix() {
  const errorFixButton = findElementByText(
    "button.bg-bolt-elements-button-primary-background",
    "Attempt fix"
  );

  if (errorFixButton && !errorFixButton.disabled) {
    errorFixButton.click();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await waitForCondition(
      () =>
        document.querySelector(
          ".bg-bolt-elements-prompt-background button.absolute"
        ),
      30000
    );

    await waitForCondition(
      () =>
        !document.querySelector(
          ".bg-bolt-elements-prompt-background button.absolute"
        ),
      180000
    );
  }
}

function handleStopAutomation() {
  automationState.isRunning = false;
  automationState.currentTask = null;
  automationState.retryCount = 0;
}

async function waitForCondition(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

async function typeText(element, text, slowType = false) {
  return new Promise((resolve) => {
    if (!slowType) {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      resolve();
      return;
    }

    let index = 0;

    const type = () => {
      if (index < text.length) {
        element.value += text[index];

        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));

        index++;
        setTimeout(type, 50 + Math.random() * 50);
      } else {
        resolve();
      }
    };

    type();
  });
}

function findElementByText(selector, text) {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).find((el) =>
    el.textContent.toLowerCase().includes(text.toLowerCase())
  );
}

if (!Element.prototype.contains) {
  Element.prototype.contains = function (text) {
    return this.textContent.toLowerCase().includes(text.toLowerCase());
  };
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;

    if (assistantIframe) {
      closeAssistant();
    }

    detectProjectChange();
  }
}).observe(document, { subtree: true, childList: true });

setTimeout(() => {
  injectButton();
}, 1000);
