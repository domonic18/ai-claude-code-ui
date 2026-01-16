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
  };

  const handleProjectDelete = (projectName) => {
    // If the deleted project was currently selected, clear it
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
    }
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
                onShowSettings={() => navigate('/settings')}
                isPWA={false}
                isMobile={isMobile}
                onToggleSidebar={() => setSidebarVisible(false)}
              />
            ) : (
              /* Collapsed Sidebar */
              <div className="h-full flex flex-col items-center py-4 gap-4">
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200 group"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m14 9 3 3-3 3" />
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
