import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on app load and validate immediately
  useEffect(() => {
    const validateStoredToken = async () => {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Immediately validate the token with the backend
          const response = await fetch('http://localhost:3001/api/users/validate', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (data.success) {
            // Token is valid, user exists
            setToken(storedToken);
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            // Token invalid or user deleted
            console.log('🚨 Stored token is invalid or user deleted:', data.error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (err) {
          // Network error or invalid stored data, clear it
          console.error('Error validating stored token:', err);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };

    validateStoredToken();
  }, []);

  // Frequent validation to check if user still exists (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const validationInterval = setInterval(async () => {
      const isValid = await validateCurrentToken();
      if (!isValid) {
        console.log('🚨 Frequent validation failed - user may have been deleted');
      }
    }, 30 * 1000); // Check every 30 seconds

    return () => clearInterval(validationInterval);
  }, [isAuthenticated, token]);

  // Validate token when app comes back into focus (user switches tabs/windows)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const handleAppFocus = async () => {

      const isValid = await validateCurrentToken();
      if (!isValid) {
        console.log('🚨 App focus validation failed - user may have been deleted');
      }
    };

    window.addEventListener('focus', handleAppFocus);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        handleAppFocus();
      }
    });

    return () => {
      window.removeEventListener('focus', handleAppFocus);
      window.removeEventListener('visibilitychange', handleAppFocus);
    };
  }, [isAuthenticated, token]);

  // Function to handle automatic logout when user is deleted
  const handleUserDeleted = () => {
    console.log('🚨 User has been deleted from database - logging out automatically');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    // You can add a toast notification here if needed
  };

  // Function to validate current token and check if user still exists
  const validateCurrentToken = async () => {
    if (!token) return false;
    
    try {
      const response = await fetch('http://localhost:3001/api/users/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        if (data.code === 'USER_DELETED') {
          handleUserDeleted();
          return false;
        }
        if (data.code === 'USER_NOT_VERIFIED') {
          handleUserDeleted();
          return false;
        }
        // Other errors - logout for security
        handleUserDeleted();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      // Network error - logout for security
      handleUserDeleted();
      return false;
    }
  };

  // Login function
  const login = async (emp_code, password) => {
    try {
      const response = await fetch('http://localhost:3001/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emp_code, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Check if user is verified
        if (!data.user.verified) {
          // Return specific error for unverified accounts
          return { success: false, error: 'Account not verified' };
        }

        // Store token and user data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        setToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        
        // Don't show toast here, let the component handle it
        return { success: true };
      } else {
        // Handle specific error codes for better user experience
        if (data.code === 'USER_NOT_FOUND') {
          return { success: false, error: 'User not found. Please go to register.', code: 'USER_NOT_FOUND' };
        } else if (data.code === 'INVALID_PASSWORD') {
          return { success: false, error: 'Invalid credentials', code: 'INVALID_PASSWORD' };
        } else {
          return { success: false, error: data.error || 'Login failed' };
        }
      }
    } catch (err) {
      // Don't show toast here, let the component handle it
      return { success: false, error: 'Network error' };
    }
  };

  // Signup function
  const signup = async (emp_code, emp_name, password) => {
    try {
      const response = await fetch('http://localhost:3001/api/users/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emp_code, emp_name, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Don't show toast here, let the component handle it
        return { success: true };
      } else {
        // Return specific error messages from backend
        return { success: false, error: data.error };
      }
    } catch (err) {
      // Don't show toast here, let the component handle it
      return { success: false, error: 'Network error' };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    // Don't show toast here, let the component handle it
  };

  // Check if token is valid
  const checkAuth = async () => {
    if (!token) return false;
    
    try {
      const response = await fetch('http://localhost:3001/api/users/verify-token', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        logout();
        return false;
      }
      
      return true;
    } catch (err) {
      logout();
      return false;
    }
  };

  // Get authenticated request headers
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
    getAuthHeaders,
    validateCurrentToken,
    handleUserDeleted,
    // Force immediate validation (can be called from components)
    forceValidation: validateCurrentToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
