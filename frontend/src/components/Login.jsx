import React, { useState, useEffect, useRef } from 'react';
import '../styles/variables.css';
import './Login.css';
import config from '../config/app-config.js';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import logo from '../styles/logo.svg';

const Login = ({ onShowSignUp }) => {
  const { login } = useAuth();
  const { error: showError, success } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [password, setPassword] = useState('');
  const networkErrorShownRef = useRef(false);
  const employeesLoadedRef = useRef(false);
  const dropdownRef = useRef(null);

  // Load employees from API - only once per component mount
  useEffect(() => {
    // Prevent double loading in React StrictMode
    if (employeesLoadedRef.current) {
      return;
    }
    
    // Check if we've already shown a network error this session
    const sessionNetworkError = localStorage.getItem('sessionNetworkError');
    if (sessionNetworkError === 'true') {
      networkErrorShownRef.current = true;
    }
    
    const loadEmployees = async () => {
      try {
        setLoading(true);
        console.log('🔄 Loading employees...');
        console.log('🔗 Backend URL:', config.backend.development.fullUrl);
        
        const response = await fetch(`${config.backend.development.fullUrl}/employees`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setEmployees(data.records || []);
            console.log('✅ Employees loaded successfully');
            // Reset network error flag on successful load
            networkErrorShownRef.current = false;
            localStorage.removeItem('sessionNetworkError');
          } else {
            console.log('❌ API returned error:', data);
            showError('Failed to load employees');
          }
        } else {
          console.log('❌ Server responded with error status:', response.status);
          showError('Failed to connect to server');
        }
      } catch (error) {
        console.error('Error loading employees:', error);
  
        // Only show network error if it hasn't been shown yet
        if (!networkErrorShownRef.current) {
          console.log('📢 Showing network error toast for employees load');
          showError('Network error - please check your connection');
          networkErrorShownRef.current = true;
          localStorage.setItem('sessionNetworkError', 'true');
        } else {
          console.log('🚫 Skipping duplicate network error toast for employees load');
        }
      } finally {
        setLoading(false);
        employeesLoadedRef.current = true;
      }
    };

    loadEmployees();
  }, [showError]); // Only depend on showError, not on any state that changes

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous login attempts
    if (loading) {
      console.log('🚫 Login already in progress, ignoring duplicate call');
      return;
    }
    
    if (!selectedEmployee) {
      showError('Please select an employee');
      return;
    }

    if (!password) {
      showError('Please enter your password');
      return;
    }

    // Find the selected employee details
    const employee = employees.find(emp => emp.employeeNo === selectedEmployee);
    
    if (employee) {
      try {
        setLoading(true);
        console.log('🔐 Attempting login for employee:', selectedEmployee);
        
        // Use the auth context login function
        const result = await login(selectedEmployee, password);
        
        if (result.success) {
          console.log('✅ Login successful');
          success(`Welcome back, ${employee.name}!`);
          // Reset network error flag on successful login
          networkErrorShownRef.current = false;
          localStorage.removeItem('sessionNetworkError');
        } else if (result.error === 'Account not verified') {
          // Show specific message for unverified accounts - DON'T clear form
          showError('Your account is not verified. Please contact your administrator to verify your account before logging in.');
        } else if (result.code === 'USER_NOT_FOUND') {
          // Show specific message for user not found - DON'T clear form
          showError('User not found. Please go to register.');
        } else if (result.code === 'INVALID_PASSWORD') {
          // Show specific message for wrong password - clear password only
          showError('Invalid credentials');
          setPassword('');
        } else {
          // Show generic error message for other failures
          showError(result.error || 'Login failed');
          // Clear the form fields
          setSelectedEmployee('');
          setEmployeeSearch('');
          setPassword('');
        }
      } catch (error) {
        console.error('Error during login:', error);

        // Only show network error if it hasn't been shown yet
        if (!networkErrorShownRef.current) {
          console.log('📢 Showing network error toast for login');
          showError('Network error. Please check your connection and try again.');
          networkErrorShownRef.current = true;
          localStorage.setItem('sessionNetworkError', 'true');
        } else {
          console.log('🚫 Skipping duplicate network error toast for login');
        }
        // Don't clear form on network errors
      } finally {
        setLoading(false);
      }
    } else {
      showError('Invalid employee selection');
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading employees...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src={logo} alt={`${config.company_name} Logo`} className="company-logo" />
          </div>
          <div className="login-brand">
            <h1>{config.company_name}</h1>
            <p>Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="employee-select">Select Employee:</label>
            <div className="searchable-dropdown" ref={dropdownRef}>
              <input
                type="text"
                placeholder="Enter your employee number"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                onFocus={() => setShowEmployeeDropdown(true)}
                className="searchable-input"
                autoComplete="off"
              />
              {showEmployeeDropdown && (
                <div className="dropdown-options">
                  {employees
                    .filter(employee => 
                      employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      employee.employeeNo.toLowerCase().includes(employeeSearch.toLowerCase())
                    )
                    .map((employee) => (
                      <div
                        key={employee.employeeNo}
                        className="dropdown-option"
                        onClick={() => {
                          setSelectedEmployee(employee.employeeNo);
                          setEmployeeSearch(`${employee.employeeNo} - ${employee.name}`);
                          setShowEmployeeDropdown(false);
                        }}
                      >
                        {employee.employeeNo} - {employee.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password:</label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-input"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="login-button" 
            disabled={!selectedEmployee || !password || loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>



        <div className="login-footer">
          <div className="login-links">
            <a href="#" className="login-link" onClick={onShowSignUp}>
              New User? Sign Up
            </a>
          </div>
          <p className="version">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

