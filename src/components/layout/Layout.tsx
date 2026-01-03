import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout">
      <main className="layout-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
