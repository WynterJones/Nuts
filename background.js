class BackgroundService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "OPENAI_REQUEST") {
        this.handleOpenAIRequest(message, sender, sendResponse);
        return true;
      } else if (message.type === "GENERATE_TASKS") {
        this.handleTaskGeneration(message, sender, sendResponse);
        return true;
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
        true
      );

      let responseContent = result.content;
      if (result.functionCalls && result.functionCalls.length > 0) {
        const functionSummary = this.generateFunctionCallSummary(
          result.functionCalls
        );

        if (
          functionSummary &&
          (!responseContent || responseContent.trim().length < 50)
        ) {
          responseContent = functionSummary;
        } else if (functionSummary) {
          responseContent = `${responseContent}\n\n${functionSummary}`;
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

      const useSupabase = message.useSupabase !== false;

      const techStack = useSupabase
        ? "React, Vite, TypeScript, Tailwind CSS, Supabase, Netlify"
        : "React, Vite, TypeScript, Tailwind CSS, Netlify";

      const databaseSection = useSupabase
        ? "   - **Database & Backend** (Supabase setup, tables, auth, policies)\n   - **Authentication & User Management**\n"
        : "   - **Frontend Data Management** (React state, localStorage only - NO database or backend)\n";

      const integrationSection = useSupabase
        ? "   - **Integration & API** (Supabase Edge Functions for server-side logic, API integrations)\n"
        : "";

      const prompt = `Based on this project description, create a comprehensive task list for building a complete web application${
        useSupabase
          ? " with database and authentication capabilities"
          : " as a client-side application"
      }.

**PROJECT DETAILS:**
Title: ${message.projectData.title}
Description: ${message.description}
Tech Stack: ${techStack}
Database/Auth: ${
        useSupabase
          ? "🟢 YES - Using Supabase for database and authentication"
          : "🔴 NO - Frontend-only, NO database, NO authentication, NO backend"
      }

**PLATFORM SPECIFICS:**
- **Bolt.new** automatically handles Netlify deployment, so do NOT create manual deployment tasks
- **Supabase** handles database, user authentication, and serverless functions - use for anything requiring API keys or environment variables
- Focus on application logic and features rather than infrastructure setup

**INSTRUCTIONS:**
1. Create 8-15 specific, actionable tasks that cover the full development lifecycle:
   - **Frontend Structure** (React components, pages, routing)
${databaseSection}   - **Core Features** (based on the description)
   - **Styling & UI/UX** (Tailwind implementation)
${integrationSection}   - **Testing & Quality** (validation, error handling)
   - **Environment & Integration** (Supabase configuration, environment variables)

2. Generate a starter prompt that will be used when initializing this project in Bolt.new. The starter prompt should:
   - Be specific to this project type and requirements
   - Include the tech stack (${techStack})
   - Mention key features from the description
   - Be concise but informative (2-3 sentences max)

${
  useSupabase
    ? "🔥 SUPABASE ENABLED: Include Supabase database setup, table creation, authentication setup, Row Level Security policies, and Supabase Edge Functions for server-side logic. Use Supabase for anything requiring API keys, environment variables, or server-side processing. Do NOT create manual Netlify deployment tasks as Bolt.new handles this automatically."
    : "🚫 SUPABASE DISABLED - CLIENT-SIDE ONLY APPLICATION:\n\n❌ STRICTLY FORBIDDEN - DO NOT CREATE ANY OF THESE TASKS:\n- Database setup, tables, schemas, migrations\n- User authentication, login, signup, user management\n- Supabase configuration, API keys, environment variables\n- Backend services, APIs, server-side logic\n- Edge Functions, serverless functions\n- Data persistence beyond localStorage/sessionStorage\n- User sessions, JWT tokens, authentication flows\n- Any task mentioning 'Supabase', 'database', 'auth', 'backend', 'server'\n\n✅ ONLY CREATE THESE TYPES OF TASKS:\n- React components and pages\n- Frontend routing (React Router)\n- UI/UX with Tailwind CSS\n- Client-side state management (useState, useContext, Redux)\n- Local data storage (localStorage, sessionStorage)\n- Static content and assets\n- Frontend form handling and validation\n- CSS animations and styling\n- Component interactions and user experience\n\nThis is a FRONTEND-ONLY application with NO backend functionality whatsoever."
}

Make each task specific and actionable. Use priority levels:
- **high**: Critical path items, dependencies for other tasks
- **normal**: Core feature development
- **low**: Polish, optimization, nice-to-have features

Use the add_task function for each task and generate_starter_prompt function for the starter prompt. Focus on creating a complete roadmap for a production-ready web application.

${
  !useSupabase
    ? "\n⚠️  FINAL REMINDER: User has DISABLED Supabase. This means ZERO database tasks, ZERO authentication tasks, ZERO backend tasks. If you create any Supabase/database/auth/backend tasks, you are doing it wrong. This is a pure frontend React application only."
    : ""
}`;

      const result = await this.callOpenAI(
        prompt,
        { projectData: message.projectData },
        config.openai_api_key,
        config.openai_model || "gpt-4o-mini",
        true
      );

      let updatedProjectData = { ...message.projectData };
      let generatedStarterPrompt = null;

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
          } else if (call.name === "generate_starter_prompt") {
            generatedStarterPrompt = call.arguments.prompt;
          }
        });

        if (generatedStarterPrompt) {
          try {
            const currentSettings = await chrome.storage.local.get(
              "app_settings"
            );
            const settings = currentSettings.app_settings || {};
            settings.starterPrompt = generatedStarterPrompt;
            await chrome.storage.local.set({ app_settings: settings });

            if (!updatedProjectData.settings) {
              updatedProjectData.settings = {
                starterPrompt: "",
                appendPrompt: "",
                waitTime: 120000,
              };
            }
            updatedProjectData.settings.starterPrompt = generatedStarterPrompt;
          } catch (error) {
            console.error("Failed to save starter prompt:", error);
          }
        }

        const taskCount = result.functionCalls.filter(
          (call) => call.name === "add_task"
        ).length;
        updatedProjectData.chatHistory = updatedProjectData.chatHistory || [];
        updatedProjectData.chatHistory.push({
          id: this.generateId(),
          role: "assistant",
          content: `🚀 Welcome to your new project! I've created ${taskCount} comprehensive tasks to help you build "${
            message.projectData.title
          }" using the React+Vite+Supabase+Netlify stack. 

These tasks cover everything from database setup to deployment. Start with the high-priority tasks and work your way through the development lifecycle.${
            generatedStarterPrompt
              ? "\n\nI've also generated a custom starter prompt for this project type that will be used when initializing new projects in Bolt."
              : ""
          } Feel free to ask me questions about any of these tasks or request additional ones as your project evolves!`,
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
        {
          type: "function",
          function: {
            name: "generate_starter_prompt",
            description:
              "Generate a starter prompt for a new project in Bolt.new",
            parameters: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "The generated starter prompt",
                },
              },
              required: ["prompt"],
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
6. **BULK OPERATIONS**: You can perform multiple task operations in a single response (add multiple tasks, complete several at once, edit many, etc.)
7. **TASK IDENTIFICATION**: For editing/completing/removing tasks, you can use partial text matching or task IDs

**AVAILABLE TASK FUNCTIONS:**
- add_task(task, priority): Add new tasks (use this liberally for comprehensive planning)
- complete_task(task_id): Mark tasks as done (supports partial text matching)  
- edit_task(task_id, new_text): Update task descriptions
- remove_task(task_id): Delete tasks (supports partial text matching)

**EXAMPLES OF BULK OPERATIONS:**
- "Add authentication system" → Create 5+ tasks covering Supabase setup, components, routing, etc.
- "Complete all database tasks" → Use complete_task multiple times
- "Update all styling tasks to use Tailwind v3" → Use edit_task for each styling task
- "Remove all testing tasks for now" → Use remove_task for each testing-related task

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

  generateFunctionCallSummary(functionCalls) {
    const callsByType = {
      add_task: [],
      edit_task: [],
      complete_task: [],
      remove_task: [],
    };

    functionCalls.forEach((call) => {
      if (callsByType[call.name]) {
        callsByType[call.name].push(call);
      }
    });

    const summaryParts = [];

    if (callsByType.add_task.length > 0) {
      const taskList = callsByType.add_task
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

      summaryParts.push(
        `✅ **Added ${callsByType.add_task.length} task${
          callsByType.add_task.length > 1 ? "s" : ""
        }:**\n${taskList}`
      );
    }

    if (callsByType.complete_task.length > 0) {
      const completedTasks = callsByType.complete_task
        .map((call) => `• ${call.arguments.task_id}`)
        .join("\n");

      summaryParts.push(
        `✅ **Completed ${callsByType.complete_task.length} task${
          callsByType.complete_task.length > 1 ? "s" : ""
        }:**\n${completedTasks}`
      );
    }

    if (callsByType.edit_task.length > 0) {
      const editedTasks = callsByType.edit_task
        .map(
          (call) =>
            `• "${call.arguments.task_id}" → "${call.arguments.new_text}"`
        )
        .join("\n");

      summaryParts.push(
        `✏️ **Edited ${callsByType.edit_task.length} task${
          callsByType.edit_task.length > 1 ? "s" : ""
        }:**\n${editedTasks}`
      );
    }

    if (callsByType.remove_task.length > 0) {
      const removedTasks = callsByType.remove_task
        .map((call) => `• ${call.arguments.task_id}`)
        .join("\n");

      summaryParts.push(
        `🗑️ **Removed ${callsByType.remove_task.length} task${
          callsByType.remove_task.length > 1 ? "s" : ""
        }:**\n${removedTasks}`
      );
    }

    if (summaryParts.length > 0) {
      return (
        summaryParts.join("\n\n") +
        "\n\nI've updated your task list accordingly. Let me know if you need any adjustments or have questions about these changes!"
      );
    }

    return null;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

new BackgroundService();
