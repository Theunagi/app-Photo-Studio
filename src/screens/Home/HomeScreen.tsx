/**
 * Home Screen — Project gallery + Fast Generation entry point.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../models/project';
import { createProject } from '../../models/project';
import { getAllProjects, deleteProject, saveProject } from '../../services/db/projectDB';
import './HomeScreen.css';

interface HomeScreenProps {
  onOpenStudio: (project: Project | null) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenStudio }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreateProject = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    const project = createProject(name);
    await saveProject(project);
    setNewName('');
    setShowNewModal(false);
    onOpenStudio(project);
  }, [newName, onOpenStudio]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteProject(id);
    setDeleteConfirm(null);
    loadProjects();
  }, [loadProjects]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateProject();
    if (e.key === 'Escape') { setShowNewModal(false); setNewName(''); }
  }, [handleCreateProject]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="home">
      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#lg)"/>
            <circle cx="14" cy="13" r="5" stroke="white" strokeWidth="1.5" fill="none"/>
            <circle cx="14" cy="13" r="2" fill="white"/>
            <rect x="8" y="7" width="12" height="1.5" rx="0.75" fill="white" opacity="0.5"/>
            <defs><linearGradient id="lg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
          </svg>
          <span className="logo-text">Photo Studio</span>
        </div>
      </header>

      <main className="home-main">
        {/* Hero — Fast Generation */}
        <section className="hero-card" onClick={() => onOpenStudio(null)}>
          <div className="hero-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M17.5 4L7 18h8l-1.5 10L25 14h-8l1.5-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="hero-text">
            <h2>Fast Generation</h2>
            <p>Quick one-off render without saving to a project</p>
          </div>
          <svg className="hero-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </section>

        {/* Projects Section */}
        <section className="projects-section">
          <div className="projects-header">
            <h3>My Projects</h3>
            <button className="btn-new" onClick={() => setShowNewModal(true)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              New Project
            </button>
          </div>

          {loading ? (
            <div className="projects-empty">
              <span className="loading-dots">Loading...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="projects-empty">
              <div className="empty-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="6" y="10" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M6 16h28M14 10V7a1 1 0 011-1h10a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p>No projects yet</p>
              <span>Create a project to organize and save your renders</span>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => onOpenStudio(project)}
                >
                  {/* Thumbnail */}
                  <div className="project-thumb">
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt={project.name} />
                    ) : (
                      <div className="thumb-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="project-info">
                    <span className="project-name">{project.name}</span>
                    <span className="project-date">{formatDate(project.updatedAt)}</span>
                  </div>

                  {/* Delete */}
                  <button
                    className="project-delete"
                    title="Delete project"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  {/* Image count badge */}
                  {project.results.autoCrop && (
                    <span className="project-badge">Done</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => { setShowNewModal(false); setNewName(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Project</h3>
            <p>Give your project a name to organize your work.</p>
            <input
              type="text"
              placeholder="e.g. RIMOWA Campaign, Dremel Product Line..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={80}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => { setShowNewModal(false); setNewName(''); }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateProject} disabled={!newName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-danger" onClick={e => e.stopPropagation()}>
            <h3>Delete Project?</h3>
            <p>This will permanently delete this project and all its saved results.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;
