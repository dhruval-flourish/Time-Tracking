import React, { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const showToast = (message, type = 'success') => {
    switch (type) {
      case 'success':
        return toast.success(message, {
          duration: 4000,
          position: 'top-right',
          style: {
            background: '#10b981',
            color: '#fff',
            fontWeight: '500',
          },
        });
      case 'error':
        return toast.error(message, {
          duration: 6000,
          position: 'top-right',
          style: {
            background: '#ef4444',
            color: '#fff',
            fontWeight: '500',
          },
        });
      case 'warning':
        return toast(message, {
          duration: 5000,
          position: 'top-right',
          icon: '⚠️',
          style: {
            background: '#f59e0b',
            color: '#fff',
            fontWeight: '500',
          },
        });
      case 'info':
        return toast(message, {
          duration: 4000,
          position: 'top-right',
          icon: 'ℹ️',
          style: {
            background: '#3b82f6',
            color: '#fff',
            fontWeight: '500',
          },
        });
      default:
        return toast(message, {
          duration: 4000,
          position: 'top-right',
        });
    }
  };

  const showLoadingToast = (message = 'Loading...') => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#6b7280',
        color: '#fff',
        fontWeight: '500',
      },
    });
  };

  const dismissToast = (toastId) => {
    toast.dismiss(toastId);
  };

  const dismissAllToasts = () => {
    toast.dismiss();
  };

  const success = (message) => showToast(message, 'success');
  const error = (message) => showToast(message, 'error');
  const warning = (message) => showToast(message, 'warning');
  const info = (message) => showToast(message, 'info');

  const value = {
    showToast,
    showLoadingToast,
    dismissToast,
    dismissAllToasts,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
};
