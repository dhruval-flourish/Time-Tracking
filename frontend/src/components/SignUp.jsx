import React, { useState, useEffect, useRef } from 'react';
import '../styles/variables.css';
import './SignUp.css';
import config, { getBackendUrl } from '../config/app-config.js';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import logo from '../styles/logo.svg';
  const SignUp = ({ onBackToLogin }) => {
  const { signup } = useAuth();
  const { error: showError, success } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dropdownRef = useRef(null);

  // Load employees from API
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${getBackendUrl()}/employees`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setEmployees(data.records || []);
          } else {
            showError('Failed to load employees');
          }
        } else {
          showError('Failed to connect to server');
        }
      } catch (error) {
        console.error('Error loading employees:', error);
        showError('Network error - please check your connection');
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [showError]);

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

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      showError('Please select an employee');
      return;
    }

    if (!password) {
      showError('Please enter your password');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long');
      return;
    }

    // Find the selected employee details
    const employee = employees.find(emp => emp.employeeNo === selectedEmployee);
    
    if (employee) {
      try {
        setLoading(true);
        
        // Use the auth context signup function
        const result = await signup(selectedEmployee, employee.name, password);
        
        if (result.success) {
          success(`Account created successfully for ${employee.name}!`);
          onBackToLogin(); // Go back to login page
        } else {
          // Show specific error message from backend
          if (result.error === 'Account already exists. Please go to login page.') {
            showError('Account already exists! Please go to the login page to sign in.');
            // Don't clear the form for existing users - let them see what they entered
          } else {
            showError(result.error || 'Signup failed. Please try again.');
            // Clear the form fields on other errors
            setSelectedEmployee('');
            setEmployeeSearch('');
            setPassword('');
          }
        }
      } catch (error) {
        showError('Signup failed. Please try again.');
        // Clear the form fields on error
        setSelectedEmployee('');
        setEmployeeSearch('');
        setPassword('');
      } finally {
        setLoading(false);
      }
    } else {
      showError('Invalid employee selection');
    }
  };

  if (loading) {
    return (
      <div className="signup-container">
        <div className="signup-card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading employees...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <div className="signup-logo">
            <img src={logo} alt={`${config.company_name} Logo`} className="company-logo" />
          </div>
          <div className="signup-brand">
            <h1>{config.company_name}</h1>
            <p>New User Registration</p>
          </div>
        </div>

        <form onSubmit={handleSignUp} className="signup-form">
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
            <label htmlFor="signup-password">Password:</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="signup-input"
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-icons">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="signup-button" 
            disabled={!selectedEmployee || !password || loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>



        <div className="signup-footer">
          <div className="signup-links">
            <a href="#" className="signup-link" onClick={onBackToLogin}>
              Already have an account? Log In
            </a>
          </div>
          <p className="version">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
