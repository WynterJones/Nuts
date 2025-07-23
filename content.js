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
   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><g fill="currentColor"><path d="m219.84 73.16l-88-48.16a8 8 0 0 0-7.68 0l-88 48.18a8 8 0 0 0-4.16 7v95.64a8 8 0 0 0 4.16 7l88 48.18a8 8 0 0 0 7.68 0l88-48.18a8 8 0 0 0 4.16-7V80.18a8 8 0 0 0-4.16-7.02M128 168a40 40 0 1 1 40-40a40 40 0 0 1-40 40" opacity="0.2"/><path d="M128 80a48 48 0 1 0 48 48a48.06 48.06 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32m95.68-93.85l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M128 224l-88-48.18V80.18L128 32l88 48.17v95.63Z"/></g></svg>
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

  const { type } = event.data;
  console.log("Received message:", type, event.data);

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
      // Send current URL back to iframe
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

        // Basic bounds checking
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
    console.log("Sending chat message:", message);

    const response = await chrome.runtime.sendMessage({
      type: "OPENAI_REQUEST",
      message: message,
      context: context,
    });

    console.log("Received response:", response);

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
    console.log("Generating tasks for:", data.projectId);

    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_TASKS",
      projectData: data.projectData,
      description: data.description,
      useSupabase: data.useSupabase,
    });

    console.log("Task generation response:", response);

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

// Automation handling functions
let automationState = {
  isRunning: false,
  currentTask: null,
  retryCount: 0,
  maxRetries: 3,
};

async function handleStartingSequence(settings) {
  console.log("Executing starting sequence...");
  automationState.isRunning = true;

  try {
    // Check if we're on bolt.new root
    if (
      window.location.href !== "https://bolt.new" &&
      window.location.href !== "https://bolt.new/"
    ) {
      throw new Error("Starting sequence can only run on https://bolt.new");
    }

    // Look for new project button or similar starting action
    const textarea = document.querySelector(
      ".bg-bolt-elements-prompt-background textarea"
    );

    if (textarea) {
      console.log("Found start button, using starter prompt...");
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
      // trigger change event
      textarea.dispatchEvent(new Event("change", { bubbles: true }));

      // delay for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // look for .bg-bolt-elements-prompt-background  button.absolute
      const newProjectButton = document.querySelector(
        ".bg-bolt-elements-prompt-background button.absolute"
      );
      console.log("New project button:", newProjectButton);
      // cllick
      if (newProjectButton) {
        newProjectButton.click();
      }
      // Wait for navigation or modal
      await waitForCondition(() => {
        return (
          window.location.href !== "https://bolt.new" ||
          document.querySelector(".modal") ||
          document.querySelector('[role="dialog"]')
        );
      }, 5000);

      // Notify completion
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
  console.log("Executing task:", data.task.text);
  automationState.isRunning = true;
  automationState.currentTask = data.task;
  automationState.retryCount = 0;

  try {
    await executeTaskInBolt(data);
  } catch (error) {
    console.error("Task execution error:", error);

    // Check if this is a timeout error (button waiting)
    const isTimeoutError =
      error.message.includes("Condition not met within") ||
      error.message.includes("timeout");

    // Don't retry timeout errors - they usually mean the task completed but button behavior was different
    if (isTimeoutError) {
      const waitTime = data.settings.waitTime || 180000;
      const waitTimeText =
        waitTime === -1 ? "indefinite wait" : `${waitTime / 1000} seconds`;
      console.log(
        `Timeout error detected after ${waitTimeText} - stopping automation`
      );

      // Stop automation instead of continuing
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

    // Handle other error retries if enabled
    if (
      data.settings.autoErrorFix &&
      automationState.retryCount < automationState.maxRetries
    ) {
      automationState.retryCount++;
      console.log(
        `Retrying task (attempt ${automationState.retryCount}/${automationState.maxRetries})`
      );

      // Wait a bit before retry
      setTimeout(() => {
        executeTaskInBolt(data);
      }, 3000);
      return;
    }

    // Max retries reached or no auto error fix
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
  // Handle Supabase migration if enabled
  if (data.settings.autoSupabaseMigration) {
    await handleSupabaseMigration();
  }

  if (data.settings.autoErrorFix) {
    await handleErrorFix();
  }

  // Find the AI prompt box
  const promptBox = document.querySelector(
    ".bg-bolt-elements-prompt-background textarea"
  );

  if (!promptBox) {
    throw new Error("Could not find AI prompt box on page");
  }

  console.log("Found prompt box:", promptBox);

  // Wait for textarea to be enabled
  await waitForCondition(() => !promptBox.disabled, 10000);

  // Clear and set the task text
  promptBox.value = "";
  promptBox.focus();

  // Type the task (instant typing)
  console.log("Typing task:", data.task.text, data);
  await typeText(promptBox, data.task.text);

  // Find the specific submit button that user confirmed works
  const submitButton = document.querySelector(
    ".bg-bolt-elements-prompt-background button.absolute"
  );

  if (!submitButton || submitButton.disabled) {
    throw new Error(
      "Submit button (.bg-bolt-elements-prompt-background button.absolute) not found or disabled"
    );
  }

  console.log("Found the .absolute button, clicking it");
  submitButton.click();

  // Wait for THE SPECIFIC BUTTON to disappear - once gone, task is complete!
  console.log("Waiting for the .absolute button to disappear...");

  // Get wait time from settings (default to 3 minutes if not set)
  const waitTime = data.settings.waitTime || 180000;
  const waitTimeText =
    waitTime === -1 ? "indefinitely" : `${waitTime / 1000} seconds`;
  console.log(`Using wait time: ${waitTimeText}`);

  await waitForCondition(
    () => {
      const specificButton = document.querySelector(
        ".bg-bolt-elements-prompt-background button.absolute"
      );
      const isGone = !specificButton;
      if (!isGone) {
        console.log("Button still present, waiting...");
      }
      return isGone;
    },
    waitTime === -1 ? Infinity : waitTime
  );

  console.log(
    "✅ The .absolute button disappeared - task processing complete!"
  );

  // Update status - processing is complete once button disappears
  if (assistantIframe) {
    assistantIframe.contentWindow.postMessage(
      {
        type: "AUTOMATION_STATUS_UPDATE",
        status: "Task completed, moving to next...",
      },
      "*"
    );
  }

  console.log("🎉 Task execution completed successfully!");

  // Small delay to ensure page is stable before moving to next task
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Task completed successfully
  if (assistantIframe) {
    assistantIframe.contentWindow.postMessage(
      {
        type: "AUTOMATION_STEP_COMPLETE",
        taskIndex: data.taskIndex,
        totalTasks: data.totalTasks,
        task: data.task, // Include the full task data so we can mark it as completed
      },
      "*"
    );
  }

  automationState.currentTask = null;
  automationState.isRunning = false;
}

async function handleErrorFix() {
  console.log("Checking for error fix prompts...");

  // Look for error fix-related buttons or prompts by text content
  const errorFixButton = findElementByText(
    "button.bg-bolt-elements-button-primary-background",
    "Attempt fix"
  );

  if (errorFixButton && !errorFixButton.disabled) {
    console.log("Found error fix button, clicking...");
    errorFixButton.click();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Wait for the error fix process to complete by waiting for the submit button to appear and disappear
    console.log("Waiting for error fix process to complete...");

    // First wait for the submit button to appear (indicating error fix is processing)
    await waitForCondition(
      () =>
        document.querySelector(
          ".bg-bolt-elements-prompt-background button.absolute"
        ),
      30000
    );

    // Then wait for the submit button to disappear (indicating error fix is complete)
    await waitForCondition(
      () =>
        !document.querySelector(
          ".bg-bolt-elements-prompt-background button.absolute"
        ),
      180000 // Longer timeout for error fix process
    );

    console.log("✅ Error fix process completed");
  }
}

async function handleSupabaseMigration() {
  console.log("Checking for Supabase migration prompts...");

  // Look for migration-related buttons or prompts
  const migrationButton =
    findElementByText("button", "Run Migration") ||
    findElementByText("button", "migration") ||
    document.querySelector('[data-testid*="migration"]') ||
    document.querySelector('button[aria-label*="migration"]');

  if (migrationButton && !migrationButton.disabled) {
    console.log("Found migration button, clicking...");
    migrationButton.click();

    // Wait for migration to complete
    await waitForCondition(() => !migrationButton.disabled, 10000);
  }
}

function handleStopAutomation() {
  console.log("Stopping automation...");
  automationState.isRunning = false;
  automationState.currentTask = null;
  automationState.retryCount = 0;
}

// Utility functions for automation
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
      // Instant typing - set value directly
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      resolve();
      return;
    }

    // Slow/human-like typing
    let index = 0;

    const type = () => {
      if (index < text.length) {
        element.value += text[index];

        // Trigger input events
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));

        index++;
        setTimeout(type, 50 + Math.random() * 50); // Variable typing speed
      } else {
        resolve();
      }
    };

    type();
  });
}

// Enhanced element finder (case-insensitive contains)
function findElementByText(selector, text) {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).find((el) =>
    el.textContent.toLowerCase().includes(text.toLowerCase())
  );
}

// Add CSS selector extension for :contains()
if (!Element.prototype.contains) {
  Element.prototype.contains = function (text) {
    return this.textContent.toLowerCase().includes(text.toLowerCase());
  };
}

// URL change detection
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;

    // Close the iframe when URL changes
    if (assistantIframe) {
      closeAssistant();
    }

    detectProjectChange();
  }
}).observe(document, { subtree: true, childList: true });

// Initialize
setTimeout(() => {
  console.log("Initializing Nuts for Bolt assistant...");
  injectButton();
}, 1000);

console.log("Nuts for Bolt content script loaded");
