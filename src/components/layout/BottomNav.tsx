import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNav.css';

interface NavItem {
  path: string;
  label: string;
  emoji: string;
  color: string;
}

const navItems: NavItem[] = [
  { path: '/feeding', label: 'Alim.', emoji: '🍼', color: 'var(--color-feeding)' },
  { path: '/diaper', label: 'Cacas', emoji: '💩', color: 'var(--color-diaper)' },
  { path: '/sleep', label: 'Sommeil', emoji: '😴', color: 'var(--color-sleep)' },
  { path: '/diversification', label: 'Div.', emoji: '🥕', color: 'var(--color-diversification)' },
  { path: '/health', label: 'Santé', emoji: '📊', color: 'var(--color-growth)' },
];

const BottomNav: React.FC = () => {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.emoji}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
