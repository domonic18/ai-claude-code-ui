/**
 * Project Services Index
 *
 * Exports all project related services for easy importing.
 */

export {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
  addProjectCollaborator,
  removeProjectCollaborator,
  getProjectCollaborators,
  updateProjectSettings,
  getProjectActivity
} from './ProjectService.js';
