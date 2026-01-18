/**
 * PRD Editor Hooks
 *
 * Custom hooks for PRD editor functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  PRDDocument,
  PRDSection,
  PRDItem,
  PRDEditorComponentProps
} from '../types';

/**
 * Hook for PRD editor functionality
 */
export interface UsePRDEditorOptions {
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  readOnly?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export interface UsePRDEditorReturn {
  document: PRDDocument | null;
  sections: PRDSection[];
  activeSection: string | null;
  isSaving: boolean;
  saveSuccess: boolean;
  hasUnsavedChanges: boolean;
  loadDocument: (content: string) => void;
  updateSection: (sectionId: string, content: string) => void;
  addSection: (section: PRDSection) => void;
  removeSection: (sectionId: string) => void;
  setActiveSection: (sectionId: string | null) => void;
  saveDocument: () => Promise<void>;
  resetDocument: () => void;
}

const DEFAULT_PRD_SECTIONS: PRDSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    content: '',
    order: 0,
  },
  {
    id: 'goals',
    title: 'Goals',
    content: '',
    order: 1,
  },
  {
    id: 'features',
    title: 'Features',
    content: '',
    order: 2,
  },
  {
    id: 'technical-requirements',
    title: 'Technical Requirements',
    content: '',
    order: 3,
  },
];

/**
 * Hook for managing PRD editor state
 */
export function usePRDEditor(options: UsePRDEditorOptions = {}): UsePRDEditorReturn {
  const {
    initialContent = '',
    onSave,
    readOnly = false,
    autoSave = false,
    autoSaveDelay = 2000,
  } = options;

  // Document state
  const [document, setDocument] = useState<PRDDocument | null>(null);
  const [sections, setSections] = useState<PRDSection[]>(DEFAULT_PRD_SECTIONS);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Refs for timeouts
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Parse PRD content into sections
   */
  const parsePRDContent = useCallback((content: string): PRDDocument => {
    const lines = content.split('\n');
    const parsedSections: PRDSection[] = [];
    let currentSection: PRDSection | null = null;

    for (const line of lines) {
      // Check for markdown headers (## or ###)
      const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
      if (headerMatch) {
        if (currentSection) {
          parsedSections.push(currentSection);
        }
        const title = headerMatch[2].trim();
        currentSection = {
          id: title.toLowerCase().replace(/\s+/g, '-'),
          title,
          content: '',
          order: parsedSections.length,
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      parsedSections.push(currentSection);
    }

    return {
      id: 'prd',
      title: 'Product Requirements Document',
      sections: parsedSections,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }, []);

  /**
   * Load document from content
   */
  const loadDocument = useCallback((content: string) => {
    try {
      const parsed = parsePRDContent(content);
      setDocument(parsed);
      if (parsed.sections.length > 0) {
        setSections(parsed.sections);
        setActiveSection(parsed.sections[0].id);
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to parse PRD content:', error);
    }
  }, [parsePRDContent]);

  /**
   * Update section content
   */
  const updateSection = useCallback((sectionId: string, content: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, content }
        : section
    ));
    setHasUnsavedChanges(true);

    // Auto-save if enabled
    if (autoSave && onSave) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument();
      }, autoSaveDelay);
    }
  }, [autoSave, autoSaveDelay, onSave]);

  /**
   * Add a new section
   */
  const addSection = useCallback((section: PRDSection) => {
    setSections(prev => [...prev, section]);
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Remove a section
   */
  const removeSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(section => section.id !== sectionId));
    if (activeSection === sectionId) {
      setActiveSection(null);
    }
    setHasUnsavedChanges(true);
  }, [activeSection]);

  /**
   * Save document
   */
  const saveDocument = useCallback(async () => {
    if (!onSave || readOnly) {
      return;
    }

    setIsSaving(true);
    try {
      // Convert sections back to markdown
      const content = sections.map(section =>
        `## ${section.title}\n\n${section.content}`
      ).join('\n\n');

      await onSave(content);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save PRD:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [sections, onSave, readOnly]);

  /**
   * Reset document to default
   */
  const resetDocument = useCallback(() => {
    setSections(DEFAULT_PRD_SECTIONS);
    setDocument(null);
    setActiveSection(null);
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Auto-reset save success indicator
   */
  useEffect(() => {
    if (saveSuccess) {
      saveSuccessTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    }

    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, [saveSuccess]);

  /**
   * Load initial content on mount
   */
  useEffect(() => {
    if (initialContent) {
      loadDocument(initialContent);
    }
  }, [initialContent, loadDocument]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

  return {
    document,
    sections,
    activeSection,
    isSaving,
    saveSuccess,
    hasUnsavedChanges,
    loadDocument,
    updateSection,
    addSection,
    removeSection,
    setActiveSection,
    saveDocument,
    resetDocument,
  };
}

/**
 * Hook for PRD templates
 */
export interface UsePRDTemplatesReturn {
  templates: PRDDocument[];
  getTemplate: (id: string) => PRDDocument | null;
  applyTemplate: (id: string) => PRDDocument | null;
}

const PRD_TEMPLATES: PRDDocument[] = [
  {
    id: 'web-app',
    title: 'Web Application',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        content: 'Brief description of the web application\n',
        order: 0,
      },
      {
        id: 'goals',
        title: 'Goals',
        content: '- Goal 1\n- Goal 2\n- Goal 3\n',
        order: 1,
      },
      {
        id: 'features',
        title: 'Features',
        content: '- Feature 1\n- Feature 2\n- Feature 3\n',
        order: 2,
      },
      {
        id: 'technical-requirements',
        title: 'Technical Requirements',
        content: '- Requirement 1\n- Requirement 2\n',
        order: 3,
      },
    ],
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0',
    },
  },
  {
    id: 'mobile-app',
    title: 'Mobile Application',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        content: 'Brief description of the mobile application\n',
        order: 0,
      },
      {
        id: 'goals',
        title: 'Goals',
        content: '- Goal 1\n- Goal 2\n- Goal 3\n',
        order: 1,
      },
      {
        id: 'features',
        title: 'Features',
        content: '- Feature 1\n- Feature 2\n- Feature 3\n',
        order: 2,
      },
      {
        id: 'technical-requirements',
        title: 'Technical Requirements',
        content: '- Requirement 1\n- Requirement 2\n',
        order: 3,
      },
    ],
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0',
    },
  },
  {
    id: 'api-service',
    title: 'API Service',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        content: 'Brief description of the API service\n',
        order: 0,
      },
      {
        id: 'goals',
        title: 'Goals',
        content: '- Goal 1\n- Goal 2\n- Goal 3\n',
        order: 1,
      },
      {
        id: 'endpoints',
        title: 'API Endpoints',
        content: '- GET /api/resource\n- POST /api/resource\n- PUT /api/resource/:id\n- DELETE /api/resource/:id\n',
        order: 2,
      },
      {
        id: 'technical-requirements',
        title: 'Technical Requirements',
        content: '- Requirement 1\n- Requirement 2\n',
        order: 3,
      },
    ],
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0',
    },
  },
];

/**
 * Hook for managing PRD templates
 */
export function usePRDTemplates(): UsePRDTemplatesReturn {
  /**
   * Get template by ID
   */
  const getTemplate = useCallback((id: string): PRDDocument | null => {
    return PRD_TEMPLATES.find(template => template.id === id) || null;
  }, []);

  /**
   * Apply template (returns a copy)
   */
  const applyTemplate = useCallback((id: string): PRDDocument | null => {
    const template = getTemplate(id);
    if (!template) {
      return null;
    }

    return {
      ...template,
      id: `prd-${Date.now()}`,
      sections: template.sections.map(section => ({
        ...section,
        id: `${section.id}-${Date.now()}`,
      })),
      metadata: {
        ...template.metadata,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    };
  }, [getTemplate]);

  return {
    templates: PRD_TEMPLATES,
    getTemplate,
    applyTemplate,
  };
}
