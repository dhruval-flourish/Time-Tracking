import React from 'react';
import config from '../config/app-config.js';
import logo from '../styles/logo.svg';

const PageHeader = ({ 
  title, 
  showProfile = false,
  currentEmployee,
  onLogout,
  showProfileDropdown,
  setShowProfileDropdown
}) => {
  return (
    <div className="page-header">
      <div className="page-header-content">
        {/* Left side - Logo, Header and Title */}
        <div className="page-header-left">
          <div className="logo-section">
            <img src={logo} alt={`${config.company_name} Logo`} className="company-logo" />
          </div>
          <div className="brand-section">
            <div className="company-brand">{config.company_name}</div>
            <div className="page-title">{title}</div>
          </div>
        </div>
        
        {/* Right side - Person Logo */}
        {showProfile && (
          <div className="page-header-right">
            <div className="profile-section">
              <button 
                className="profile-icon" 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                title="Profile"
              >
                <span className="material-icons">account_circle</span>
              </button>
              {showProfileDropdown && (
                <div className="profile-dropdown">
                  <div className="profile-info">
                    <div className="profile-name">{currentEmployee?.name || currentEmployee?.emp_code || 'Unknown User'}</div>
                    <div className="profile-id">ID: {currentEmployee?.employeeNo || currentEmployee?.emp_code || 'N/A'}</div>
                  </div>
                  <button onClick={onLogout} className="dropdown-logout">
                    <span className="material-icons">logout</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
