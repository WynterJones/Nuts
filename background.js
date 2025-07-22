class BackgroundService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "OPENAI_REQUEST") {
        this.handleOpenAIRequest(message, sender);
      } else if (message.type === "GENERATE_TASKS_FROM_DESCRIPTION") {
        this.handleTaskGeneration(message, sender);
      }
    });
  }

  async handleOpenAIRequest(message, sender) {
    try {
      const config = await chrome.storage.local.get([
        "openai_api_key",
        "openai_model",
      ]);

      if (!config.openai_api_key) {
        this.sendResponse(sender.tab.id, {
          error:
            "OpenAI API key not configured. Please set it up in the extension popup.",
        });
        return;
      }

      const result = await this.callOpenAI(
        message.message,
        message.context,
        config.openai_api_key,
        config.openai_model || "gpt-3.5-turbo",
        true // Enable function calling
      );

      this.sendResponse(sender.tab.id, {
        response: result.content,
        functionCalls: result.functionCalls,
      });
    } catch (error) {
      this.sendResponse(sender.tab.id, {
        error: error.message || "Failed to get AI response",
      });
    }
  }

  async handleTaskGeneration(message, sender) {
    try {
      const config = await chrome.storage.local.get([
        "openai_api_key",
        "openai_model",
      ]);

      if (!config.openai_api_key) {
        return;
      }

      const taskPrompt = `Based on this project description, generate 3-5 initial tasks that would help build this project. Focus on practical development steps.

Project: ${message.data.projectData.title}
Description: ${message.data.description}
Tech Stack: ${message.data.projectData.techStack.join(", ")}

Please add these tasks to the project using the add_task function. Make them specific and actionable.`;

      const result = await this.callOpenAI(
        taskPrompt,
        { projectData: message.data.projectData },
        config.openai_api_key,
        config.openai_model || "gpt-3.5-turbo",
        true
      );

      // Send the function calls to create initial tasks
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "OPENAI_RESPONSE",
        response: `I've created some initial tasks for your project "${message.data.projectData.title}" based on your description.`,
        functionCalls: result.functionCalls,
      });
    } catch (error) {
      console.error("Error generating tasks:", error);
    }
  }

  async callOpenAI(message, context, apiKey, model, withFunctions = true) {
    const systemPrompt = this.buildSystemPrompt(context);

    const requestBody = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    };

    // Add function calling capabilities
    if (withFunctions && context?.projectData) {
      requestBody.tools = [
        {
          type: "function",
          function: {
            name: "add_task",
            description: "Add a new task to the project todo list",
            parameters: {
              type: "object",
              properties: {
                task: {
                  type: "string",
                  description: "The task description",
                },
                priority: {
                  type: "string",
                  enum: ["low", "normal", "high"],
                  description: "Task priority level",
                },
              },
              required: ["task"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "complete_task",
            description: "Mark a task as completed",
            parameters: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The task ID or partial task text to complete",
                },
              },
              required: ["task_id"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "remove_task",
            description: "Remove a task from the todo list",
            parameters: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The task ID or partial task text to remove",
                },
              },
              required: ["task_id"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "edit_task",
            description: "Edit an existing task",
            parameters: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The task ID or partial task text to edit",
                },
                new_text: {
                  type: "string",
                  description: "The new task text",
                },
              },
              required: ["task_id", "new_text"],
            },
          },
        },
      ];
      requestBody.tool_choice = "auto";
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    const result = {
      content: choice.message?.content || "",
      functionCalls: [],
    };

    // Process function calls
    if (choice.message?.tool_calls) {
      result.functionCalls = choice.message.tool_calls.map((call) => ({
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments),
      }));
    }

    return result;
  }

  buildSystemPrompt(context) {
    const basePrompt = `You are Nuts for Bolt - an AI assistant helping with web development projects on bolt.new. 

You can help with:
- Managing project todos and tasks (you can add, complete, remove, and edit tasks)
- Answering coding questions
- Providing development guidance
- Reviewing code and suggesting improvements
- Planning project features
- Creating automation rules and workflows

IMPORTANT: When users ask you to manage tasks, use the provided functions:
- add_task: Add new tasks to the project
- complete_task: Mark tasks as completed
- remove_task: Remove tasks from the list
- edit_task: Edit existing task text

Be helpful, concise, and focused on practical development advice. When managing tasks, always use the functions rather than just describing what to do.`;

    if (context?.project) {
      const todosList = context.todos
        ? context.todos
            .map(
              (todo, index) =>
                `${index + 1}. [${todo.completed ? "✓" : " "}] ${
                  todo.text
                } (ID: ${todo.id})`
            )
            .join("\n")
        : "No todos yet";

      return `${basePrompt}

Current project: ${context.project}
Current todos:
${todosList}

${
  context.chatHistory
    ? `Recent conversation: ${context.chatHistory
        .slice(-3)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n")}`
    : ""
}`;
    }

    return basePrompt;
  }

  sendResponse(tabId, data) {
    chrome.tabs.sendMessage(tabId, {
      type: "OPENAI_RESPONSE",
      ...data,
    });
  }
}

new BackgroundService();
