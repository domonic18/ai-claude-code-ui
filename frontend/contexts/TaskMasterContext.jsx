import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useWebSocketContext } from '@/shared/contexts/WebSocketContext';

const TaskMasterContext = createContext({
  // TaskMaster project state
  projects: [],
  currentProject: null,
  projectTaskMaster: null,
  
  // MCP server state
  mcpServerStatus: null,
  
  // Tasks state
  tasks: [],
  nextTask: null,
  
  // Loading states
  isLoading: false,
  isLoadingTasks: false,
  isLoadingMCP: false,
  
  // Error state
  error: null,
  
  // Actions
  refreshProjects: () => {},
  setCurrentProject: () => {},
  refreshTasks: () => {},
  refreshMCPStatus: () => {},
  clearError: () => {}
});

export const useTaskMaster = () => {
  const context = useContext(TaskMasterContext);
  if (!context) {
    throw new Error('useTaskMaster must be used within a TaskMasterProvider');
  }
  return context;
};

export const TaskMasterProvider = ({ children }) => {
  // Get WebSocket messages from shared context to avoid duplicate connections
  const { messages } = useWebSocketContext();
  
  // Authentication context
  const { user, isLoading: authLoading } = useAuth();
  
  // State
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProjectState] = useState(null);
  const [projectTaskMaster, setProjectTaskMaster] = useState(null);
  const [mcpServerStatus, setMCPServerStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [nextTask, setNextTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingMCP, setIsLoadingMCP] = useState(false);
  const [error, setError] = useState(null);

  // Helper to handle API errors
  const handleError = (error, context) => {
    console.error(`TaskMaster ${context} error:`, error);
    setError({
      message: error.message || `Failed to ${context}`,
      context,
      timestamp: new Date().toISOString()
    });
  };

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // This will be defined after the functions are declared

  // Refresh projects with TaskMaster metadata
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
      const enrichedProjects = projectsData.map(project => ({
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
          setProjectTaskMaster(updatedCurrent.taskmaster);
        }
      }
    } catch (err) {
      handleError(err, 'load projects');
    } finally {
      setIsLoading(false);
    }
  }, [user]); // 只依赖 user

  // Set current project and load its TaskMaster details
  const setCurrentProject = useCallback(async (project) => {
    try {
      setCurrentProjectState(project);

      setTasks([]);
      setNextTask(null);

      setProjectTaskMaster(project?.taskmaster || null);
    } catch (err) {
      console.error('Error in setCurrentProject:', err);
      handleError(err, 'set current project');
      setProjectTaskMaster(project?.taskmaster || null);
    }
  }, []);

  // Refresh MCP server status
  const refreshMCPStatus = useCallback(async () => {
    // Only make API calls if user is authenticated
    if (!user) {
      setMCPServerStatus(null);
      return;
    }

    try {
      setIsLoadingMCP(true);
      clearError();
      const mcpStatus = await api.get('/mcp-utils/taskmaster-server');
      setMCPServerStatus(mcpStatus);
    } catch (err) {
      handleError(err, 'check MCP server status');
    } finally {
      setIsLoadingMCP(false);
    }
  }, [user]); // 移除 token 依赖

  // Refresh tasks for current project - load real TaskMaster data
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
      const nextTask = data.tasks?.find(task => 
        task.status === 'pending' || task.status === 'in-progress'
      ) || null;
      setNextTask(nextTask);
      
      
    } catch (err) {
      console.error('Error loading tasks:', err);
      handleError(err, 'load tasks');
      // Set empty state on error
      setTasks([]);
      setNextTask(null);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [currentProject, user]); // 移除 token 依赖

  // Load initial data on mount or when auth changes
  // 注意：移除了 refreshProjects() 调用，因为 App.jsx 已经在用户登录时调用 fetchProjects
  // 这里只需要刷新 MCP 状态
  useEffect(() => {
    // 只有用户登录后才加载数据
    if (!authLoading && user) {
      // refreshProjects(); // 已移除 - 避免与 App.jsx 的 fetchProjects 重复调用
      refreshMCPStatus();
    }
  }, [refreshMCPStatus, authLoading, user]); // 移除 refreshProjects 依赖

  // Clear errors when authentication changes
  useEffect(() => {
    if (user) {
      clearError();
    }
  }, [user, clearError]); // 移除 token 依赖

  // Refresh tasks when current project changes
  useEffect(() => {
    if (currentProject?.name && user) {
      refreshTasks();
    }
  }, [currentProject?.name, user, refreshTasks]); // 移除 token 依赖

  // Handle WebSocket messages for TaskMaster updates
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
  const contextValue = {
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
};

export default TaskMasterContext;