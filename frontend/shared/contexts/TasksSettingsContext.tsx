import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/shared/services';
import { useAuth } from './AuthContext';

export interface InstallationStatus {
  installation?: {
    isInstalled: boolean;
  };
  isReady: boolean;
  [key: string]: any;
}

export interface TasksSettingsContextValue {
  tasksEnabled: boolean;
  setTasksEnabled: (enabled: boolean) => void;
  toggleTasksEnabled: () => void;
  isTaskMasterInstalled: boolean | null;
  isTaskMasterReady: boolean | null;
  installationStatus: InstallationStatus | null;
  isCheckingInstallation: boolean;
}

const TasksSettingsContext = createContext<TasksSettingsContextValue | undefined>(undefined);

export const useTasksSettings = (): TasksSettingsContextValue => {
  const context = useContext(TasksSettingsContext);
  if (!context) {
    throw new Error('useTasksSettings must be used within a TasksSettingsProvider');
  }
  return context;
};

export interface TasksSettingsProviderProps {
  children: React.ReactNode;
}

export const TasksSettingsProvider: React.FC<TasksSettingsProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [tasksEnabled, setTasksEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('tasks-enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isTaskMasterInstalled, setIsTaskMasterInstalled] = useState<boolean | null>(null);
  const [isTaskMasterReady, setIsTaskMasterReady] = useState<boolean | null>(null);
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus | null>(null);
  const [isCheckingInstallation, setIsCheckingInstallation] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('tasks-enabled', JSON.stringify(tasksEnabled));
  }, [tasksEnabled]);

  useEffect(() => {
    if (!user) {
      setIsCheckingInstallation(false);
      return;
    }

    const checkInstallation = async () => {
      try {
        const response = await api.get('/taskmaster/installation-status');
        if (response.ok) {
          const data: InstallationStatus = await response.json();
          setInstallationStatus(data);
          setIsTaskMasterInstalled(data.installation?.isInstalled || false);
          setIsTaskMasterReady(data.isReady || false);

          const userEnabledTasks = localStorage.getItem('tasks-enabled');
          if (!data.installation?.isInstalled && !userEnabledTasks) {
            setTasksEnabled(false);
          }
        } else {
          setIsTaskMasterInstalled(false);
          setIsTaskMasterReady(false);
        }
      } catch (error) {
        setIsTaskMasterInstalled(false);
        setIsTaskMasterReady(false);
      } finally {
        setIsCheckingInstallation(false);
      }
    };

    setTimeout(checkInstallation, 0);
  }, [user]);

  const toggleTasksEnabled = (): void => {
    setTasksEnabled(prev => !prev);
  };

  const contextValue: TasksSettingsContextValue = {
    tasksEnabled,
    setTasksEnabled,
    toggleTasksEnabled,
    isTaskMasterInstalled,
    isTaskMasterReady,
    installationStatus,
    isCheckingInstallation
  };

  return (
    <TasksSettingsContext.Provider value={contextValue}>
      {children}
    </TasksSettingsContext.Provider>
  );
};

export default TasksSettingsContext;
