/**
 * TaskMasterContext
 *
 * Provides TaskMaster project and task management functionality.
 * Integrates with WebSocket for real-time updates.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '@/shared/services';
import { useAuth } from './AuthContext';
import { useWebSocketContext } from './WebSocketContext';

// ===== Type Definitions =====

/**
 * TaskMaster metadata from backend
 */
export interface TaskMasterMetadata {
  taskCount: number;
  completed: number;
}

/**
 * TaskMaster status from backend
 */
export interface TaskMasterData {
  hasTaskmaster: boolean;
  status: 'not-configured' | 'active' | 'paused' | 'error';
  metadata?: TaskMasterMetadata;
}

/**
 * Project with TaskMaster data
 */
export interface TaskMasterProject {
  name: string;
  path: string;
  taskmaster?: TaskMasterData;
  taskMasterConfigured?: boolean;
  taskMasterStatus?: string;
  taskCount?: number;
  completedCount?: number;
}

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

/**
 * Task priority
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual task in TaskMaster
 */
export interface TaskMasterTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  assignee?: string;
  tags?: string[];
}

/**
 * Error with context information
 */
export interface TaskMasterError {
  message: string;
  context: string;
  timestamp: string;
}

/**
 * MCP server status
 */
export interface McpServerStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  lastError?: string;
}

/**
 * TaskMaster context value
 */
export interface TaskMasterContextValue {
  // TaskMaster project state
  projects: TaskMasterProject[];
  currentProject: TaskMasterProject | null;
  projectTaskMaster: TaskMasterData | null;

  // MCP server state
  mcpServerStatus: McpServerStatus | null;

  // Tasks state
  tasks: TaskMasterTask[];
  nextTask: TaskMasterTask | null;

  // Loading states
  isLoading: boolean;
  isLoadingTasks: boolean;
  isLoadingMCP: boolean;

  // Error state
  error: TaskMasterError | null;

  // Actions
  refreshProjects: () => Promise<void>;
  setCurrentProject: (project: TaskMasterProject | null) => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshMCPStatus: () => Promise<void>;
  clearError: () => void;
}

/**
 * TaskMaster provider props
 */
export interface TaskMasterProviderProps {
  children: ReactNode;
}

// ===== Context Creation =====

const TaskMasterContext = createContext<TaskMasterContextValue | null>(null);

// ===== Hook =====

/**
 * Hook to access TaskMaster context
 * @throws Error if used outside TaskMasterProvider
 */
export function useTaskMaster(): TaskMasterContextValue {
  const context = useContext(TaskMasterContext);
  if (!context) {
    throw new Error('useTaskMaster must be used within a TaskMasterProvider');
  }
  return context;
}

// ===== Provider Component =====

/**
 * TaskMaster provider component
 */
export function TaskMasterProvider({ children }: TaskMasterProviderProps): JSX.Element {
  // Get WebSocket messages from shared context to avoid duplicate connections
  const { messages } = useWebSocketContext();

  // Authentication context
  const { user, isLoading: authLoading } = useAuth();

  // State
  const [projects, setProjects] = useState<TaskMasterProject[]>([]);
  const [currentProject, setCurrentProjectState] = useState<TaskMasterProject | null>(null);
  const [projectTaskMaster, setProjectTaskMaster] = useState<TaskMasterData | null>(null);
  const [mcpServerStatus, setMCPServerStatus] = useState<McpServerStatus | null>(null);
  const [tasks, setTasks] = useState<TaskMasterTask[]>([]);
  const [nextTask, setNextTask] = useState<TaskMasterTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingMCP, setIsLoadingMCP] = useState(false);
  const [error, setError] = useState<TaskMasterError | null>(null);

  /**
   * Helper to handle API errors
   */
  const handleError = (err: Error | { message?: string }, context: string) => {
    console.error(`TaskMaster ${context} error:`, err);
    setError({
      message: err.message || `Failed to ${context}`,
      context,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh projects with TaskMaster metadata
   */
  const refreshProjects = useCallback(async () => {
    // Only make API calls if user is authenticated
    if (!user) {
      setProjects([]);
      setCurrentProjectState(null);
      return;
    }

    try {
      setIsLoading(true);
      clearError();
      const response = await api.get('/projects');

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const responseData = await response.json();
      // 后端返回 {success: true, data: [...], meta: {...}}
      const projectsData = responseData.data;

      // Check if projectsData is an array
      if (!Array.isArray(projectsData)) {
        console.error('Projects API returned non-array data:', projectsData);
        setProjects([]);
        return;
      }

      // Filter and enrich projects with TaskMaster data
      const enrichedProjects: TaskMasterProject[] = projectsData.map((project: any) => ({
        ...project,
        taskMasterConfigured: project.taskmaster?.hasTaskmaster || false,
        taskMasterStatus: project.taskmaster?.status || 'not-configured',
        taskCount: project.taskmaster?.metadata?.taskCount || 0,
        completedCount: project.taskmaster?.metadata?.completed || 0
      }));

      setProjects(enrichedProjects);

      // If current project is set, update its TaskMaster data
      if (currentProject) {
        const updatedCurrent = enrichedProjects.find(p => p.name === currentProject.name);
        if (updatedCurrent) {
          setCurrentProjectState(updatedCurrent);
          setProjectTaskMaster(updatedCurrent.taskmaster || null);
        }
      }
    } catch (err) {
      handleError(err as Error, 'load projects');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentProject, clearError]);

  /**
   * Set current project and load its TaskMaster details
   */
  const setCurrentProject = useCallback(async (project: TaskMasterProject | null) => {
    try {
      setCurrentProjectState(project);

      setTasks([]);
      setNextTask(null);

      setProjectTaskMaster(project?.taskmaster || null);
    } catch (err) {
      console.error('Error in setCurrentProject:', err);
      handleError(err as Error, 'set current project');
      setProjectTaskMaster(project?.taskmaster || null);
    }
  }, []);

  /**
   * Refresh MCP server status
   */
  const refreshMCPStatus = useCallback(async () => {
    // Only make API calls if user is authenticated
    if (!user) {
      setMCPServerStatus(null);
      return;
    }

    try {
      setIsLoadingMCP(true);
      clearError();
      const response = await api.get('/mcp-utils/taskmaster-server');

      if (!response.ok) {
        throw new Error(`Failed to check MCP status: ${response.status}`);
      }

      const mcpStatus = await response.json();
      setMCPServerStatus(mcpStatus);
    } catch (err) {
      handleError(err as Error, 'check MCP server status');
    } finally {
      setIsLoadingMCP(false);
    }
  }, [user, clearError]);

  /**
   * Refresh tasks for current project - load real TaskMaster data
   */
  const refreshTasks = useCallback(async () => {
    if (!currentProject) {
      setTasks([]);
      setNextTask(null);
      return;
    }

    // Only make API calls if user is authenticated
    if (!user) {
      setTasks([]);
      setNextTask(null);
      return;
    }

    try {
      setIsLoadingTasks(true);
      clearError();

      // Load tasks from the TaskMaster API endpoint
      const response = await api.get(`/taskmaster/tasks/${encodeURIComponent(currentProject.name)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load tasks');
      }

      const data = await response.json();

      setTasks(data.tasks || []);

      // Find next task (pending or in-progress)
      const nextTaskData = data.tasks?.find((task: TaskMasterTask) =>
        task.status === 'pending' || task.status === 'in-progress'
      ) || null;
      setNextTask(nextTaskData);

    } catch (err) {
      console.error('Error loading tasks:', err);
      handleError(err as Error, 'load tasks');
      // Set empty state on error
      setTasks([]);
      setNextTask(null);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [currentProject, user, clearError]);

  /**
   * Load initial data on mount or when auth changes
   * 注意：移除了 refreshProjects() 调用，因为 App.jsx 已经在用户登录时调用 fetchProjects
   * 这里只需要刷新 MCP 状态
   */
  useEffect(() => {
    // 只有用户登录后才加载数据
    if (!authLoading && user) {
      // refreshProjects(); // 已移除 - 避免与 App.jsx 的 fetchProjects 重复调用
      refreshMCPStatus();
    }
  }, [refreshMCPStatus, authLoading, user]); // 移除 refreshProjects 依赖

  /**
   * Clear errors when authentication changes
   */
  useEffect(() => {
    if (user) {
      clearError();
    }
  }, [user, clearError]); // 移除 token 依赖

  /**
   * Refresh tasks when current project changes
   */
  useEffect(() => {
    if (currentProject?.name && user) {
      refreshTasks();
    }
  }, [currentProject?.name, user, refreshTasks]); // 移除 token 依赖

  /**
   * Handle WebSocket messages for TaskMaster updates
   */
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    switch (latestMessage.type) {
      case 'taskmaster-project-updated':
        // Refresh projects when TaskMaster state changes
        if (latestMessage.projectName) {
          refreshProjects();
        }
        break;

      case 'taskmaster-tasks-updated':
        // Refresh tasks for the current project
        if (latestMessage.projectName === currentProject?.name) {
          refreshTasks();
        }
        break;

      case 'taskmaster-mcp-status-changed':
        // Refresh MCP server status
        refreshMCPStatus();
        break;

      default:
        // Ignore non-TaskMaster messages
        break;
    }
  }, [messages, refreshProjects, refreshTasks, refreshMCPStatus, currentProject]);

  // Context value
  const contextValue: TaskMasterContextValue = {
    // State
    projects,
    currentProject,
    projectTaskMaster,
    mcpServerStatus,
    tasks,
    nextTask,
    isLoading,
    isLoadingTasks,
    isLoadingMCP,
    error,

    // Actions
    refreshProjects,
    setCurrentProject,
    refreshTasks,
    refreshMCPStatus,
    clearError
  };

  return (
    <TaskMasterContext.Provider value={contextValue}>
      {children}
    </TaskMasterContext.Provider>
  );
}

export default TaskMasterContext;
