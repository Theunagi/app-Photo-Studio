/**
 * Home Screen — Sidebar layout with project gallery.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../models/project';
import { createProject } from '../../models/project';
import { getAllProjects, deleteProject, saveProject } from '../../services/db/projectDB';
import './HomeScreen.css';
import { getAllCollections } from '../../services/db/collectionDB';
import { getProjectsByCollection } from '../../services/db/projectDB';
import type { Collection } from '../../models/collection';

interface HomeScreenProps {
  onOpenStudio: (project: Project | null) => void;
  onMassImport?: () => void;
  userName?: string;
  userAvatar?: string;
  credits?: number;
  onSignOut?: () => void;
  onGoPricing?: () => void;
  onGoSettings?: () => void;
  collectionFilter?: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenStudio,
  onMassImport,
  userName = 'User',
  userAvatar,
  credits,
  onSignOut,
  onGoPricing,
  onGoSettings,
  collectionFilter,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<'large' | 'medium' | 'small'>('medium');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(collectionFilter ?? null);

  const loadProjects = useCallback(async () => {
    try {
      if (activeCollection) {
        const list = await getProjectsByCollection(activeCollection);
        setProjects(list);
      } else {
        const list = await getAllProjects();
        setProjects(list);
      }
      const cols = await getAllCollections();
      setCollections(cols);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCollection]);

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

  // Pick the best available image for a project card (final > original)
  const getBestThumbnail = (p: Project): string | undefined => {
    const isImg = (s?: string) => s && (s.startsWith('data:') || s.startsWith('http'));
    const r = p.results;
    return isImg(r.autoCrop) ? r.autoCrop
      : isImg(r.retouch) ? r.retouch
      : isImg(r.shadowComposite) ? r.shadowComposite
      : isImg(r.studioGeneration) ? r.studioGeneration
      : p.thumbnail;
  };

  // Get recent projects (last 3 with names)
  const recentProjects = projects.slice(0, 3);

  return (
    <div className="home">
      {/* ===== Sidebar ===== */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <svg className="sidebar-logo-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="20" cy="8" r="2" fill="currentColor"/>
          </svg>
          <span className="sidebar-logo-text">FrameFlow</span>
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          <button className="sidebar-btn-primary" onClick={() => setShowNewModal(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            New Project
          </button>
          <button className="sidebar-btn-ghost" onClick={() => onOpenStudio(null)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M9.5 3L5 9h4l-1 4L13 7H9l.5-4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Fast Generation
          </button>
          {onMassImport && (
            <button className="sidebar-btn-ghost" onClick={onMassImport}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 8.5v3a1 1 0 001 1h10a1 1 0 001-1v-3M7 1.5v7M4.5 4L7 1.5 9.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Mass Import
            </button>
          )}
        </div>

        {/* Workspace */}
        <div className="sidebar-section">
          <span className="sidebar-label">/ WORKSPACE</span>
          <button className={`sidebar-nav-item ${!activeCollection ? 'active' : ''}`} onClick={() => setActiveCollection(null)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            All Projects
          </button>
        </div>

        {/* Collections */}
        {collections.length > 0 && (
          <div className="sidebar-section">
            <span className="sidebar-label">/ COLLECTIONS</span>
            {activeCollection && (
              <button
                className="sidebar-nav-item"
                onClick={() => setActiveCollection(null)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                All Projects
              </button>
            )}
            {collections.map(c => (
              <button
                key={c.id}
                className={`sidebar-nav-item ${activeCollection === c.id ? 'active' : ''}`}
                onClick={() => setActiveCollection(c.id)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M2 6.5h12M5 4V2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span className="sidebar-project-name">{c.name}</span>
                <span className="sidebar-collection-count">{c.projectCount}</span>
              </button>
            ))}
          </div>
        )}

        {/* Recent */}
        {recentProjects.length > 0 && (
          <div className="sidebar-section">
            <span className="sidebar-label">/ RECENT</span>
            {recentProjects.map(p => (
              <button
                key={p.id}
                className="sidebar-nav-item"
                onClick={() => onOpenStudio(p)}
              >
                <span className="sidebar-dot" />
                <span className="sidebar-project-name">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="sidebar-spacer" />

        {/* Bottom — User */}
        <div className="sidebar-bottom">
          <div className="sidebar-user" onClick={onGoPricing}>
            <div className="sidebar-avatar">
              {userAvatar ? (
                <img src={userAvatar} alt="" />
              ) : (
                <span>{(userName || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <span className="sidebar-username">{userName}</span>
            {credits !== undefined && (
              <span className="sidebar-credits">{credits} credits</span>
            )}
          </div>
          <button className="sidebar-bottom-btn" onClick={onGoSettings ?? onGoPricing}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 1.5h3l.4 1.6a5.5 5.5 0 011.3.7l1.5-.6 1.5 2.6-1.2 1a5.5 5.5 0 010 1.4l1.2 1-1.5 2.6-1.5-.6a5.5 5.5 0 01-1.3.7l-.4 1.6h-3l-.4-1.6a5.5 5.5 0 01-1.3-.7l-1.5.6-1.5-2.6 1.2-1a5.5 5.5 0 010-1.4l-1.2-1 1.5-2.6 1.5.6a5.5 5.5 0 011.3-.7l.4-1.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Settings
          </button>
          <button className="sidebar-bottom-btn" onClick={onSignOut}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 13H3.5A1.5 1.5 0 012 11.5v-7A1.5 1.5 0 013.5 3H6M10.5 11L14 8l-3.5-3M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="home-main">
        {/* Projects Header */}
        <div className="projects-header">
          <h1>{activeCollection ? collections.find(c => c.id === activeCollection)?.name ?? 'Collection' : 'My Projects'}</h1>
          <div className="projects-header-right">
            {/* Grid size toggle */}
            <div className="grid-toggle">
              <button
                className={`grid-toggle-btn ${gridSize === 'large' ? 'active' : ''}`}
                onClick={() => setGridSize('large')}
                title="Large"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
              <button
                className={`grid-toggle-btn ${gridSize === 'medium' ? 'active' : ''}`}
                onClick={() => setGridSize('medium')}
                title="Medium"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="5.5" y="1" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="10" y="1" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="1" y="5.5" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="5.5" y="5.5" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="10" y="5.5" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="1" y="10" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="5.5" y="10" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="10" y="10" width="3" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
              </button>
              <button
                className={`grid-toggle-btn ${gridSize === 'small' ? 'active' : ''}`}
                onClick={() => setGridSize('small')}
                title="Small"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="4.5" y="1" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="8" y="1" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="11" y="1" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="1" y="4.5" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="4.5" y="4.5" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="8" y="4.5" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="11" y="4.5" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="1" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="4.5" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="8" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="11" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="1" y="11" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="4.5" y="11" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="8" y="11" width="2" height="2" rx="0.5" fill="currentColor"/>
                  <rect x="11" y="11" width="2" height="2" rx="0.5" fill="currentColor"/>
                </svg>
              </button>
            </div>
            {onMassImport && (
              <button className="btn-mass-import" onClick={onMassImport}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 8.5v3a1 1 0 001 1h10a1 1 0 001-1v-3M7 1.5v7M4.5 4L7 1.5 9.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Mass Import
              </button>
            )}
            <button className="btn-new" onClick={() => setShowNewModal(true)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* Projects Grid */}
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
          <div className={`projects-grid grid-${gridSize}`}>
            {projects.map(project => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => onOpenStudio(project)}
              >
                {/* Thumbnail */}
                <div className="project-thumb">
                  {getBestThumbnail(project) ? (
                    <img
                      src={getBestThumbnail(project)}
                      alt={project.name}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="thumb-placeholder">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {/* Delete — top right */}
                  <button
                    className="project-delete"
                    title="Delete project"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Label — below image */}
                <div className="project-label">
                  <span className="project-label-dot" />
                  <div className="project-label-text">
                    <span className="project-label-sub">Project</span>
                    <span className="project-label-name">{project.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ===== New Project Modal ===== */}
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

      {/* ===== Delete Confirmation Modal ===== */}
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
