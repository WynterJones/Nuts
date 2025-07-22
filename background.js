class BackgroundService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "OPENAI_REQUEST") {
        this.handleOpenAIRequest(message, sender, sendResponse);
        return true; // Indicates we will respond asynchronously
      } else if (message.type === "GENERATE_TASKS") {
        this.handleTaskGeneration(message, sender, sendResponse);
        return true; // Indicates we will respond asynchronously
      }
    });
  }

  async handleOpenAIRequest(message, sender, sendResponse) {
    try {
      const config = await chrome.storage.local.get([
        "openai_api_key",
        "openai_model",
      ]);

      if (!config.openai_api_key) {
        sendResponse({
          error:
            "OpenAI API key not configured. Please set it up in the extension popup.",
          content: null,
          functionCalls: [],
        });
        return;
      }

      const result = await this.callOpenAI(
        message.message,
        message.context,
        config.openai_api_key,
        config.openai_model || "gpt-4o-mini",
        true // Enable function calling
      );

      // If the AI created tasks, enhance the response to confirm what was created
      let responseContent = result.content;
      if (result.functionCalls && result.functionCalls.length > 0) {
        const taskCalls = result.functionCalls.filter(
          (call) => call.name === "add_task"
        );
        if (taskCalls.length > 0) {
          if (!responseContent || responseContent.trim().length < 50) {
            // Generate a better response if the AI didn't provide one
            const taskList = taskCalls
              .map(
                (call, index) =>
                  `${index + 1}. ${call.arguments.task} ${
                    call.arguments.priority === "high"
                      ? "🔥"
                      : call.arguments.priority === "low"
                      ? "🟡"
                      : "🟢"
                  }`
              )
              .join("\n");

            responseContent = `I've created ${taskCalls.length} task${
              taskCalls.length > 1 ? "s" : ""
            } for your project:\n\n${taskList}\n\nThese tasks are designed to help you build your web app systematically using the React+Vite+Supabase+Netlify stack. Let me know if you'd like me to break down any of these further or add additional tasks!`;
          }
        }
      }

      sendResponse({
        content: responseContent,
        functionCalls: result.functionCalls,
        error: null,
      });
    } catch (error) {
      console.error("OpenAI request error:", error);
      sendResponse({
        error: error.message || "Failed to get AI response",
        content: null,
        functionCalls: [],
      });
    }
  }

  async handleTaskGeneration(message, sender, sendResponse) {
    try {
      const config = await chrome.storage.local.get([
        "openai_api_key",
        "openai_model",
      ]);

      if (!config.openai_api_key) {
        sendResponse({
          error: "OpenAI API key not configured",
          updatedProjectData: null,
        });
        return;
      }

      const prompt = `Based on this project description, create a comprehensive task list for building a complete web application using the React+Vite+Supabase+Netlify tech stack.

**PROJECT DETAILS:**
Title: ${message.projectData.title}
Description: ${message.description}
Tech Stack: React, Vite, TypeScript, Tailwind CSS, Supabase, Netlify

**INSTRUCTIONS:**
Create 8-15 specific, actionable tasks that cover the full development lifecycle:
1. **Database & Backend** (Supabase setup, tables, auth, policies)
2. **Frontend Structure** (React components, pages, routing)
3. **Authentication & User Management**
4. **Core Features** (based on the description)
5. **Styling & UI/UX** (Tailwind implementation)
6. **Integration & API** (Supabase functions if needed)
7. **Testing & Quality** (validation, error handling)
8. **Deployment & Production** (Netlify deployment, environment setup)

Make each task specific and actionable. Use priority levels:
- **high**: Critical path items, dependencies for other tasks
- **normal**: Core feature development
- **low**: Polish, optimization, nice-to-have features

Use the add_task function for each task. Focus on creating a complete roadmap for a production-ready web application.`;

      const result = await this.callOpenAI(
        prompt,
        { projectData: message.projectData },
        config.openai_api_key,
        config.openai_model || "gpt-4o-mini",
        true // Enable function calling
      );

      let updatedProjectData = { ...message.projectData };

      if (result.functionCalls && result.functionCalls.length > 0) {
        result.functionCalls.forEach((call) => {
          if (call.name === "add_task") {
            const args = call.arguments;
            const todo = {
              id: this.generateId(),
              text: args.task,
              completed: false,
              priority: args.priority || "normal",
              createdAt: new Date().toISOString(),
              createdBy: "ai",
            };
            updatedProjectData.todos.push(todo);
          }
        });

        // Add a welcome message to chat history
        const taskCount = result.functionCalls.filter(
          (call) => call.name === "add_task"
        ).length;
        updatedProjectData.chatHistory = updatedProjectData.chatHistory || [];
        updatedProjectData.chatHistory.push({
          id: this.generateId(),
          role: "assistant",
          content: `🚀 Welcome to your new project! I've created ${taskCount} comprehensive tasks to help you build "${message.projectData.title}" using the React+Vite+Supabase+Netlify stack. 

These tasks cover everything from database setup to deployment. Start with the high-priority tasks and work your way through the development lifecycle. Feel free to ask me questions about any of these tasks or request additional ones as your project evolves!`,
          timestamp: new Date().toISOString(),
        });
      }

      updatedProjectData.lastUpdated = new Date().toISOString();

      sendResponse({
        updatedProjectData: updatedProjectData,
        error: null,
      });
    } catch (error) {
      console.error("Task generation error:", error);
      sendResponse({
        error: error.message || "Failed to generate tasks",
        updatedProjectData: null,
      });
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
    let basePrompt = `You are Nuts for Bolt, an AI assistant specialized in helping developers build modern web applications using the Bolt.new platform.

**ABOUT BOLT.NEW PLATFORM:**
Bolt.new is a browser-based development environment that runs within a WebContainer (browser-based Node.js runtime). Understanding these capabilities and constraints is crucial for creating realistic, executable tasks.

**BOLT.NEW CAPABILITIES:**

**Frontend Frameworks:**
- React with TypeScript (preferred stack)
- Vite as the build tool and dev server (not Next.js)
- React Router for client-side routing
- Vanilla JavaScript/TypeScript applications
- Other modern frameworks like Vue, Svelte, or Angular when needed

**Backend & Database:**
- Supabase (preferred database solution)
- Supabase Edge Functions for serverless functionality
- Node.js applications and APIs
- JavaScript-implemented databases like SQLite when needed

**Styling & UI:**
- Tailwind CSS for styling (primary choice)
- Lucide React for icons
- CSS-in-JS solutions
- Standard CSS/SCSS

**Deployment:**
- Netlify (preferred deployment platform)
- Static site hosting optimized builds

**KEY CONSTRAINTS:**
- Works within WebContainer (browser-based Node.js runtime)
- NO native binaries or system-level tools
- Python limited to standard library only
- NO C/C++, Rust, or Git available
- Focus on JavaScript/TypeScript ecosystem

**YOUR ROLE:**
- Help users plan, organize, and track web application development projects
- Create comprehensive, actionable task lists for building full-stack web applications
- Provide guidance on React components, Supabase database design, authentication flows, and deployment strategies
- Break down complex features into manageable development tasks that CAN BE EXECUTED in Bolt.new
- Suggest best practices for the React+Vite+Supabase+Netlify stack

**TASK MANAGEMENT:**
When users describe features or ask for help with their web app, you should:
1. **CREATE MULTIPLE TASKS** using the add_task function - don't hesitate to create 5-15 tasks for comprehensive features
2. **BREAK DOWN BY LAYERS**: Create separate tasks for frontend components, backend logic, database setup, styling, testing, and deployment
3. **BE SPECIFIC AND BOLT-COMPATIBLE**: Each task should be actionable within Bolt's constraints (e.g., "Create UserProfile React component with Tailwind styling" not "Install native dependencies")
4. **PRIORITIZE**: Use priority levels (high/normal/low) based on dependencies and importance
5. **RESPOND AFTERWARDS**: Always explain what tasks you created and why

**TASK CATEGORIES TO CONSIDER (BOLT-COMPATIBLE):**
- **Database**: Supabase table creation, relationships, Row Level Security policies, triggers
- **Authentication**: Supabase Auth integration, protected routes, role-based access
- **Frontend Components**: React components, pages, layouts, forms with TypeScript
- **State Management**: React Context, custom hooks, data fetching with Supabase
- **Styling**: Tailwind classes, responsive design, component styling with Lucide icons
- **Functions**: Supabase Edge Functions for business logic, API integrations
- **Real-time**: Supabase real-time subscriptions, WebSocket connections
- **Deployment**: Netlify configuration, environment variables, build optimization with Vite
- **Testing**: Component tests, integration tests (within JavaScript ecosystem)
- **Performance**: Code splitting, lazy loading, caching strategies with React/Vite

**AVOID TASKS THAT REQUIRE:**
- Native binaries or system-level installations
- Languages outside JavaScript/TypeScript ecosystem (except standard Python)
- Git operations (not available in WebContainer)
- Docker or containerization
- Native mobile app development
- Server provisioning or infrastructure setup

**COMMUNICATION STYLE:**
- Be encouraging and supportive
- Explain your reasoning for task breakdown
- Suggest modern development patterns and best practices within Bolt's ecosystem
- Always confirm what tasks you've created after using functions
- Focus on web applications that can be built and deployed entirely within Bolt.new`;

    if (context?.projectData) {
      const project = context.projectData;
      basePrompt += `\n\n**CURRENT PROJECT CONTEXT:**
Project: "${project.title}"
Tech Stack: ${
        project.techStack?.join(", ") || "React, Vite, TypeScript, Tailwind"
      }`;

      if (project.description) {
        basePrompt += `\nDescription: ${project.description}`;
      }

      if (project.todos && project.todos.length > 0) {
        const completedCount = project.todos.filter((t) => t.completed).length;
        basePrompt += `\nCurrent Tasks: ${completedCount}/${project.todos.length} completed`;

        const recentTasks = project.todos
          .slice(-5)
          .map((t) => `- ${t.completed ? "✅" : "⏳"} ${t.text}`)
          .join("\n");
        basePrompt += `\nRecent Tasks:\n${recentTasks}`;
      }
    }

    return basePrompt;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

new BackgroundService();
