/**
 * TestRefactoredSidebar Component
 *
 * Test page for comparing old and new Sidebar implementations.
 * This page uses the refactored Sidebar from the features/sidebar module.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../features/sidebar/components';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import MainContent from './MainContent';
import MobileNav from './MobileNav';

/**
 * TestRefactoredSidebar Component
 *
 * Displays the refactored Sidebar alongside the main content for testing.
 */
export function TestRefactoredSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Project and session state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch projects when user logs in
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Fetch projects function
  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await api.projects();

      if (!response.ok) {
        console.error('Failed to fetch projects:', response.status, response.statusText);
        setProjects([]);
        return;
      }

      const responseData = await response.json();
      const data = responseData.data || [];

      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Event handlers
  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    // Don't navigate in test page - stay on test page to test Sidebar functionality
  };

  const handleSessionSelect = (session, projectName) => {
    setSelectedSession(session);
    // Find the project and set it as selected
    const project = projects.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
    }
    // Don't navigate in test page - stay on test page to test Sidebar functionality
  };

  const handleSessionDelete = (projectName, sessionId, provider) => {
    // If the deleted session was currently selected, clear it
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
    }

    // Update projects state locally to remove the deleted session
    setProjects(prevProjects =>
      prevProjects.map(project => {
        if (project.name === projectName) {
          return {
            ...project,
            sessions: project.sessions?.filter(session => session.id !== sessionId) || [],
            cursorSessions: project.cursorSessions?.filter(session => session.id !== sessionId) || [],
            codexSessions: project.codexSessions?.filter(session => session.id !== sessionId) || [],
            sessionMeta: {
              ...project.sessionMeta,
              total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
            }
          };
        }
        return project;
      })
    );
  };

  const handleProjectDelete = (projectName) => {
    // If the deleted project was currently selected, clear it
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
    }
  };

  const handleNewSession = (projectName) => {
    console.log('New session requested for project:', projectName);
    // Find the project to get display name
    const project = projects.find(p => p.name === projectName);
    const displayName = project?.displayName || projectName;
    // In a real application, this would create a new session
    // For testing purposes, show a message or navigate to main interface
    alert(`New session for project "${displayName}" - this would create a new Claude session`);
    // Alternatively, navigate to main interface:
    // navigate('/');
  };

  const handleSidebarRefresh = async () => {
    await fetchProjects();
  };

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Sidebar with Refactored Component */}
      {!isMobile && (
        <div
          className={`h-full flex-shrink-0 border-r border-border bg-card transition-all duration-300 ${
            sidebarVisible ? 'w-80' : 'w-14'
          }`}
        >
          <div className="h-full overflow-hidden">
            {sidebarVisible ? (
              <Sidebar
                projects={projects}
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                onProjectSelect={handleProjectSelect}
                onSessionSelect={handleSessionSelect}
                onSessionDelete={handleSessionDelete}
                onProjectDelete={handleProjectDelete}
                isLoading={isLoadingProjects}
                onRefresh={handleSidebarRefresh}
                onNewSession={handleNewSession}
                onShowSettings={() => navigate('/settings')}
                isPWA={false}
                isMobile={isMobile}
                onToggleSidebar={() => setSidebarVisible(false)}
              />
            ) : (
              /* Collapsed Sidebar */
              <div className="h-full flex flex-col items-center py-4 gap-4">
                {/* Expand Button */}
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200 group"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <svg
                    className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Settings Icon */}
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200"
                  aria-label="Settings"
                  title="Settings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <div className="fixed inset-0 z-50 flex bg-background">
          <Sidebar
            projects={projects}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            onProjectSelect={handleProjectSelect}
            onSessionSelect={handleSessionSelect}
            onSessionDelete={handleSessionDelete}
            onProjectDelete={handleProjectDelete}
            isLoading={isLoadingProjects}
            onRefresh={handleSidebarRefresh}
            onNewSession={handleNewSession}
            onShowSettings={() => navigate('/settings')}
            isPWA={false}
            isMobile={isMobile}
            onToggleSidebar={() => navigate('/')}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header showing this is a test page */}
        <div className="border-b border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">测试页面: 重构后的 Sidebar</span>
              <span className="text-xs text-muted-foreground">(/test-sidebar)</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              返回原版
            </button>
          </div>
        </div>

        {/* Original Main Content */}
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          onSessionSelect={handleSessionSelect}
          onMenuClick={() => {}}
          isLoading={isLoadingProjects}
          isMobile={isMobile}
          isPWA={false}
        />
      </div>

      {/* Mobile Navigation */}
      {isMobile && <MobileNav onOpenSettings={() => navigate('/settings')} />}
    </div>
  );
}

export default TestRefactoredSidebar;
