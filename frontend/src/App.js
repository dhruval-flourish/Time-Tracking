import React, { useState } from 'react';
import './App.css';
import { AuthProvider } from './contexts/AuthContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { useAuth } from './contexts/AuthContext.js';
import { useToast } from './contexts/ToastContext.js';
import Login from './components/Login.jsx';
import SignUp from './components/SignUp.jsx';
import SalesOrders from './components/SalesOrders.jsx';
import TimeTracking from './components/TimeTracking.jsx';
import Recent from './components/Recent.jsx';

// Main App Component with Authentication
const AppContent = () => {
  const { user, isAuthenticated, isLoading, logout, validateCurrentToken } = useAuth();
  const { success } = useToast();
  const [currentPage, setCurrentPage] = useState('jobs');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleShowSignUp = () => {
    setShowSignUp(true);
  };

  const handleBackToLogin = () => {
    setShowSignUp(false);
  };

  const handleLogout = () => {
    logout();
    setCurrentPage('jobs');
    setShowProfileDropdown(false);
  };

  // Wrapper function to validate user before changing pages
  const handlePageChange = async (newPage) => {
    // Validate user before allowing page change
    const isValid = await validateCurrentToken();
    if (isValid) {
      setCurrentPage(newPage);
    } else {
      // User validation failed, they will be logged out automatically
      console.log('🚨 Page change blocked - user validation failed');
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'jobs':
        return (
          <SalesOrders
            currentEmployee={user}
            onLogout={handleLogout}
            showProfileDropdown={showProfileDropdown}
            setShowProfileDropdown={setShowProfileDropdown}
            setCurrentPage={handlePageChange}
          />
        );
            case 'time':
        return (
          <TimeTracking
            currentEmployee={user}
            onLogout={handleLogout}
            showProfileDropdown={showProfileDropdown}
            setShowProfileDropdown={setShowProfileDropdown}
          />
        );
      case 'recent':
        return (
          <Recent
            currentEmployee={user}
            onLogout={handleLogout}
            showProfileDropdown={showProfileDropdown}
            setShowProfileDropdown={setShowProfileDropdown}
          />
        );
 
      default:
        return (
          <SalesOrders
            currentEmployee={user}
            onLogout={handleLogout}
            showProfileDropdown={showProfileDropdown}
            setShowProfileDropdown={setShowProfileDropdown}
          />
        );
    }
  };

  // Navigation items
  const navItems = [
    { id: 'jobs', name: 'Active Jobs', icon: 'work' },
    { id: 'time', name: 'Time Tracking', icon: 'schedule' },
    { id: 'recent', name: 'Recent', icon: 'history' }
  ];

  // Handle navigation with validation
  const handleNavigation = (pageId) => {
    handlePageChange(pageId);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show authentication pages
  if (!isAuthenticated) {
    if (showSignUp) {
      return (
        <SignUp
          onSignUp={() => {
            success('Account created successfully! Please log in.');
            setShowSignUp(false);
          }}
          onBackToLogin={handleBackToLogin}
        />
      );
    }
    return <Login onShowSignUp={handleShowSignUp} />;
  }

  // Show main app
  return (
    <div className="app">
      {/* Top Bar - Only Chaos Academy */}
      <div className="top-bar">
        <div className="top-bar-content">
          <div className="company-name">
            Flourish Management Consulting
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {renderContent()}

        {/* Bottom Navigation */}
        <div className="bottom-nav">
          <div className="nav-grid">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                aria-label={item.name}
              >
                <span className="nav-icon material-icons">{item.icon}</span>
                <span className="nav-text">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// App wrapper with providers
const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
