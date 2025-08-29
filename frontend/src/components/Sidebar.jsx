import React from 'react';
import './Sidebar.css';
import config from '../config/app-config.js';

const Sidebar = ({ activeModule, onModuleChange, isExpanded, onToggle }) => {
  const modules = [
    { id: 'sales', name: 'Active Jobs', icon: '📋' },
    { id: 'time', name: 'Time Tracking', icon: '⏱️' },
    { id: 'admin', name: 'Admin Panel', icon: '⚙️' },
    { id: 'settings', name: 'Settings', icon: '🔧' }
  ];

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Hamburger Menu Button */}
      <div className="sidebar-header">
        <button className="hamburger-menu" onClick={onToggle}>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        {isExpanded && (
          <div className="header-title">
            <h1 className="company-name">{config.company_name}</h1>
            <p className="company-subtitle">Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onModuleChange(module.id)}
            className={`nav-button ${activeModule === module.id ? 'active' : ''}`}
            title={!isExpanded ? module.name : ''}
          >
            <span className="nav-icon">{module.icon}</span>
            {isExpanded && <span className="nav-text">{module.name}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
