import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PageHeader from './PageHeader.jsx';
import timeTrackingService from '../services/timeTrackingService';
import config, { getBackendUrl } from '../config/app-config.js';

const TimeTracking = ({ currentEmployee, onLogout, showProfileDropdown, setShowProfileDropdown }) => {
  const { isAuthenticated, user } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  
  // State variables
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [comment, setComment] = useState('');
  const [activeTimers, setActiveTimers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);

  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pausedTimers, setPausedTimers] = useState(new Set()); // Track paused timers
  const [loadingTimers, setLoadingTimers] = useState(new Set()); // Track loading timers
  const [favoriteAccountInfo, setFavoriteAccountInfo] = useState(null);
  const [showEndTimerPopup, setShowEndTimerPopup] = useState(false);
  const [selectedTimerForEnd, setSelectedTimerForEnd] = useState(null);
  const [endTotalTime, setEndTotalTime] = useState('');
  const [endComment, setEndComment] = useState('');
  const [endTimerLoading, setEndTimerLoading] = useState(false);
  const [continuousAdjustmentInterval, setContinuousAdjustmentInterval] = useState(null);
  const [activeAdjustment, setActiveAdjustment] = useState(0); // Track which adjustment is active (0, 10, or -10)
  const [isAdjusting, setIsAdjusting] = useState(false); // Prevent rapid multiple adjustments
  const [showAddTimePopup, setShowAddTimePopup] = useState(false);
  const [addTimeHours, setAddTimeHours] = useState('');
  const [addTimeMinutes, setAddTimeMinutes] = useState('');
  const [addTimeLoading, setAddTimeLoading] = useState(false);

  // Get logged-in employee info
  const loggedInEmployee = user || currentEmployee;
  const employeeCode = loggedInEmployee?.emp_code;
  const employeeName = loggedInEmployee?.emp_name || loggedInEmployee?.name;

  // Handle selected job from localStorage
  useEffect(() => {
    // Add a small delay to ensure localStorage data persists
    const timer = setTimeout(() => {
      const selectedJobNo = localStorage.getItem('selectedJobNo');
      const selectedJobId = localStorage.getItem('selectedJobId');
      const selectedJobName = localStorage.getItem('selectedJobName');
            if (selectedJobNo && selectedJobId && selectedJobName && jobs.length > 0) {
        // Find the matching job from the jobs array - handle both string and number ID types

        
        const matchingJob = jobs.find(job => {
          const match = job.id === selectedJobId || 
                       job.id === parseInt(selectedJobId) || 
                       job.id === selectedJobId.toString();
          if (match) {
            console.log('✅ Found matching job:', { jobId: job.id, jobType: typeof job.id, selectedId: selectedJobId, selectedType: typeof selectedJobId });
          }
          return match;
        });
        
        
        
        if (matchingJob) {
          // Properly select the job using the existing handleJobSelect logic
  

          
          // Set the job search term for display
          setJobSearchTerm(`${selectedJobNo} - ${selectedJobName}`);
          // Set the selected job ID
          setSelectedJob(selectedJobId);
          // Close the dropdown
          setShowJobDropdown(false);
          
          // Check if account information is available from favorites BEFORE clearing
          const selectedAccountNo = localStorage.getItem('selectedAccountNo');
          const selectedAccountName = localStorage.getItem('selectedAccountName');
          
  
          
          if (selectedAccountNo && selectedAccountName) {
            // Store favorite account info in state to use when accounts are loaded
            setFavoriteAccountInfo({ accountNo: selectedAccountNo, accountName: selectedAccountName });
            console.log('✅ Account info from favorite stored in state:', { selectedAccountNo, selectedAccountName });
            
            // Clear account localStorage
            localStorage.removeItem('selectedAccountNo');
            localStorage.removeItem('selectedAccountName');
          } else {
            console.log('⚠️ No account data found in localStorage');
          }
          
          // Clear previous account selection and fetch new accounts
          setAccounts([]);
          
          // Only call fetchJobCostingAccounts if it's defined
          if (typeof fetchJobCostingAccounts === 'function') {
    
            fetchJobCostingAccounts(selectedJobNo);
          } else {
            console.log('⚠️ fetchJobCostingAccounts function not yet defined');
          }
          
          // Clear the localStorage AFTER successfully processing the data
          localStorage.removeItem('selectedJobNo');
          localStorage.removeItem('selectedJobId');
          localStorage.removeItem('selectedJobName');
          console.log('✅ localStorage cleared after successful job selection');
        } else {
          console.log('❌ No matching job found for ID:', selectedJobId);
        }
      } else {

      }
    }, 200); // 200ms delay to ensure data persistence
    
    return () => clearTimeout(timer);
  }, [jobs]); // Add jobs as dependency to run when jobs are loaded

  // Auto-fill account from favorites when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0 && favoriteAccountInfo) {
      
      
      // Find the account ID that matches the account number from favorites
      const matchingAccount = accounts.find(acc => acc.accountNo === favoriteAccountInfo.accountNo);
      
      if (matchingAccount) {
        console.log('✅ Auto-filling account from favorites:', matchingAccount);
        setSelectedAccount(matchingAccount.id);
        setAccountSearchTerm(`${matchingAccount.accountNo} - ${matchingAccount.name}`);
        
        // Clear the favorite account info since we've used it
        setFavoriteAccountInfo(null);
      } else {
        console.log('⚠️ Account from favorites not found in available accounts:', favoriteAccountInfo.accountNo);

      }
    }
  }, [accounts, favoriteAccountInfo]);

  // Fetch active time entries from database
  useEffect(() => {
    if (!isAuthenticated) return; // Only fetch if authenticated
    
    const fetchActiveEntries = async () => {
      try {
        console.log('🚀 Fetching active time entries from database...');
        const result = await timeTrackingService.getActiveEntries();
        
        if (result.success) {
          const activeEntries = result.data || [];
          console.log('📊 Raw active entries from backend:', activeEntries);
          // Transform database entries to match component structure
          const transformedTimers = activeEntries.map(entry => ({
            id: entry.id,
            job_no: entry.job_no,
            job_name: entry.job_name,
            employee_code: entry.employee_code,
            employee_name: entry.employee_name,
            account_no: entry.account_no,
            account_name: entry.account_name,
            comment: entry.comment,
            status: entry.status,
            total_seconds: entry.total_seconds || 0,
            startTime: new Date(entry.start_time),
            elapsedTime: (entry.total_seconds || 0) * 1000 + // Stored accumulated time
                        (Date.now() - new Date(entry.start_time).getTime()) // Time since last resume (or start if never paused)
          }));
          
          // Initialize paused timers based on database status
          const pausedTimerIds = new Set(
            transformedTimers
              .filter(timer => timer.status === 'paused')
              .map(timer => timer.id)
          );
          setPausedTimers(pausedTimerIds);
          
          setActiveTimers(transformedTimers);
          console.log(`✅ Successfully loaded ${transformedTimers.length} active timers from database`);
          console.log('📊 Paused timers:', pausedTimerIds);
        } else {
          console.error('Failed to fetch active entries:', result.error);
        }
      } catch (err) {
        console.error('❌ Error loading active entries:', err);
      }
    };

    fetchActiveEntries();
    
    // Remove automatic refresh - it overwrites our local state changes
    // const interval = setInterval(fetchActiveEntries, 30000);
    // return () => clearInterval(interval);
  }, [isAuthenticated]); // Add isAuthenticated as dependency



  // Fetch jobs from API (same as Active Jobs)
  useEffect(() => {
    if (!isAuthenticated) return; // Only fetch if authenticated
    
    const fetchJobs = async () => {
      try {
        console.log('🚀 Fetching jobs from local API server...');
        
        // Use local backend API endpoint - no search parameter needed
        const apiUrl = `${getBackendUrl()}/jobs`;
        console.log('🔗 API URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const jobsData = await response.json();
        console.log('📊 API Response:', jobsData);
        
        // Transform API data to match our component structure - use same logic as SalesOrders
        const transformedJobs = (jobsData.records || []).map(job => ({
          id: job.id || job.code,  // Same logic as SalesOrders
          jobNo: job.code || job.orderNo || `JOB-${job.id}`,  // Same logic as SalesOrders
          jobName: job.name || job.description || 'Unnamed Job',  // Same logic as SalesOrders
          status: job.status || 'Unknown',  // Same logic as SalesOrders
          apiResponse: job
        }));
        
        

        
        setJobs(transformedJobs);
        console.log(`✅ Successfully loaded ${transformedJobs.length} jobs from API`);
      } catch (err) {
        console.error('❌ Error loading jobs:', err);
        // Show error state instead of mock data
        setJobs([]);
        setError('Failed to load jobs. Please try again later.');
      }
    };

    fetchJobs();
  }, [isAuthenticated]); // Add isAuthenticated as dependency

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showJobDropdown && !event.target.closest('.searchable-dropdown')) {
        setShowJobDropdown(false);
      }
      if (showAccountDropdown && !event.target.closest('.searchable-dropdown')) {
        setShowAccountDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showJobDropdown, showAccountDropdown]);

  // Handle account selection
  const handleAccountSelect = (account) => {
    console.log('🎯 Selected Account Details:', {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountNo: account.accountNo,
      fullAccountObject: account
    });
    
    setSelectedAccount(account.id);
    setAccountSearchTerm(`${account.accountNo} - ${account.name}`);
    setShowAccountDropdown(false);
  };

  // Update elapsed time for active timers every second
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setActiveTimers(prevTimers => prevTimers.map(timer => {
        // Only update elapsed time for active timers, not paused ones
        if (timer.status === 'paused') {
          return timer; // Keep paused timer unchanged
        }
        
        // Calculate new elapsed time
        const newElapsedTime = (timer.total_seconds || 0) * 1000 + // Stored accumulated time
                              (Date.now() - timer.startTime.getTime()); // Time since last resume (or start if never paused)
        
        return {
          ...timer,
          elapsedTime: newElapsedTime
        };
      }));
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [activeTimers.length]);

  // Periodically sync total_seconds to database for active timers (every 30 seconds)
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const syncInterval = setInterval(async () => {
      const activeTimersToSync = activeTimers.filter(timer => 
        timer.status === 'active' && !pausedTimers.has(timer.id)
      );
      
      if (activeTimersToSync.length === 0) return;
      
      console.log('🔄 Syncing active timers to database...');
      
      for (const timer of activeTimersToSync) {
        try {
          // Calculate current accumulated time
          const currentElapsedSeconds = Math.floor(timer.elapsedTime / 1000);
          
          // Only update if the time has changed significantly (more than 10 seconds)
          if (Math.abs(currentElapsedSeconds - (timer.total_seconds || 0)) > 10) {
            console.log(`📝 Syncing timer ${timer.id}: ${timer.total_seconds || 0}s → ${currentElapsedSeconds}s`);
            
            // Update the database with current accumulated time
            await timeTrackingService.updateEntry(timer.id, {
              total_seconds: currentElapsedSeconds
            });
            
            // Update local state to reflect the sync
            setActiveTimers(prev => prev.map(t => 
              t.id === timer.id 
                ? { ...t, total_seconds: currentElapsedSeconds }
                : t
            ));
          }
        } catch (err) {
          console.error(`❌ Error syncing timer ${timer.id}:`, err);
        }
      }
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(syncInterval);
  }, [activeTimers, pausedTimers]);

  // Debug Add Time popup data
  useEffect(() => {
    if (showAddTimePopup) {

    }
  }, [showAddTimePopup, selectedJob, selectedAccount, jobs, accounts]);

  // Reusable GPS location capture function
  const captureGPSLocation = async (context = 'general') => {
    if (!navigator.geolocation) {
      throw new Error('GPS location is not supported in your browser. Please use a different browser or device.');
    }

    try {
      console.log(`🎯 Attempting GPS location capture for: ${context}`);
      
      // Check permission state first
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          console.log('🔐 Location permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            console.log('❌ Location permission denied by user');
            throw new Error('Location access denied. Please enable location permissions in your browser settings to track your work location.');
          } else if (permissionStatus.state === 'prompt') {
            console.log('❓ Location permission not yet decided - will prompt user');
          }
        } catch (permError) {
          console.log('⚠️ Could not check permission status:', permError.message);
        }
      }
      
      // Get current location with improved accuracy settings
      const locationData = await new Promise((resolve, reject) => {
        const options = {
          enableHighAccuracy: true,
          timeout: 30000, // 30 seconds
          maximumAge: 0, // Force fresh location
          forceRequest: true
        };
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy, altitude } = position.coords;
            console.log(`📍 GPS Location captured for ${context}:`, { latitude, longitude, accuracy, altitude });
            
            // Determine accuracy status based on accuracy level
            let accuracyStatus;
            if (accuracy <= 20) {
              accuracyStatus = 'excellent';
            } else if (accuracy <= 50) {
              accuracyStatus = 'good';
            } else if (accuracy <= 100) {
              accuracyStatus = 'acceptable';
            } else if (accuracy <= 200) {
              accuracyStatus = 'poor';
            } else {
              accuracyStatus = 'very_poor';
            }
            
            console.log(`📍 GPS Accuracy: ${accuracy}m (${accuracyStatus})`);
            
            // Always accept the location, but with accuracy status
            resolve({
              type: 'gps',
              latitude,
              longitude,
              accuracy,
              altitude,
              timestamp: position.timestamp,
              accuracy_status: accuracyStatus,
              accuracy_description: `${accuracy.toFixed(1)}m - ${accuracyStatus.replace('_', ' ')}`
            });
          },
          (error) => {
            console.log(`❌ GPS Error for ${context}:`, error.message);
            reject(new Error(`GPS Error: ${error.message}`));
          },
          options
        );
      });
      
      console.log(`✅ Location captured successfully for ${context}:`, locationData);
      return locationData;
      
    } catch (locationError) {
      console.error(`❌ Failed to get GPS location for ${context}:`, locationError);
      throw locationError;
    }
  };

  // Unified timer update function for pause, resume, and end operations
  const updateTimer = async (timerId, operation, additionalData = {}) => {
    try {
      console.log(`🔄 Updating timer ${timerId} with operation: ${operation}`);
      
      // Set loading state for this timer
      setLoadingTimers(prev => new Set(prev).add(timerId));
      
      // Find the current timer
      const currentTimer = activeTimers.find(timer => timer.id === timerId);
      if (!currentTimer) {
        throw new Error('Timer not found');
      }
      
      let updateData = {};
      let successMessage = '';
      
      switch (operation) {
        case 'pause':
          // Calculate current elapsed time and pause timer
          const currentElapsedSeconds = Math.floor(currentTimer.elapsedTime / 1000);
          updateData = {
            total_seconds: currentElapsedSeconds,
            start_time: new Date().toISOString(),
            status: 'paused'
          };
          successMessage = `Timer paused successfully at ${formatTime(currentElapsedSeconds * 1000)}!`;
          break;
          
        case 'resume':
          // Check if there are already active timers (not paused)
          const activeTimersCount = activeTimers.filter(timer => 
            timer.status === 'active' && !pausedTimers.has(timer.id)
          ).length;
          
          if (activeTimersCount > 0) {
            showError('You already have an active timer running. Please pause or stop the existing timer first.');
            return;
          }
          
          // Resume timer - update status to active
          updateData = {
            status: 'active',
            start_time: new Date().toISOString()
          };
          successMessage = 'Timer resumed successfully!';
          break;
          
        case 'end':
          // End timer - complete with final time, comment, end location, and end time
          updateData = {
            total_seconds: additionalData.totalSeconds || 0,
            comment: additionalData.comment || '',
            status: 'completed',
            end_location: additionalData.endLocation || null,
            end_time: new Date()
          };
          successMessage = 'Timer ended successfully!';
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      console.log(`📝 Updating timer with ${operation} data:`, updateData);
      
      // Update the timer entry
      const result = await timeTrackingService.updateEntry(timerId, updateData);
      
      if (result.success) {
        console.log(`✅ Timer ${operation} successful:`, result.data);
        
        // Update local state based on operation
        if (operation === 'pause') {
          // Add to paused set and update timer
          setPausedTimers(prev => new Set(prev).add(timerId));
          setActiveTimers(prev => prev.map(timer => 
            timer.id === timerId 
              ? { 
                  ...timer, 
                  status: 'paused', 
                  total_seconds: updateData.total_seconds,
                  startTime: new Date(updateData.start_time)
                }
              : timer
          ));
          console.log('✅ Timer paused - added to paused set');
        } else if (operation === 'resume') {
          // Remove from paused set and update timer
          setPausedTimers(prev => {
            const newPaused = new Set(prev);
            newPaused.delete(timerId);
            return newPaused;
          });
          setActiveTimers(prev => prev.map(timer => 
            timer.id === timerId 
              ? { ...timer, status: 'active', startTime: new Date(updateData.start_time) }
              : timer
          ));
          console.log('✅ Timer resumed - removed from paused set');
        } else if (operation === 'end') {
          // Remove timer completely and clean up popup state
          setActiveTimers(prev => {
            const newActive = prev.filter(timer => timer.id !== timerId);
            console.log(`🗑️ Removing timer ${timerId} from active timers. Before: ${prev.length}, After: ${newActive.length}`);
            return newActive;
          });
          setPausedTimers(prev => {
            const newPaused = new Set(prev);
            newPaused.delete(timerId);
            console.log(`🗑️ Removing timer ${timerId} from paused timers. Before: ${prev.size}, After: ${newPaused.size}`);
            return newPaused;
          });
          
          // Close end timer popup if it was open
          if (showEndTimerPopup) {
            setShowEndTimerPopup(false);
            setSelectedTimerForEnd(null);
            setEndTotalTime('');
            setEndComment('');
            console.log('✅ End timer popup closed');
          }
          
          // Don't refresh from database here - it can re-add ended timers
          // The local state update is sufficient for immediate UI feedback
          console.log('✅ Timer ended and removed from local state');
        }
        
        showSuccess(successMessage);
        return result;
        
      } else {
        throw new Error(result.error || `Failed to ${operation} timer`);
      }
      
    } catch (err) {
      console.error(`❌ Error ${operation}ing timer:`, err);
      showError(`Failed to ${operation} timer: ${err.message}`);
      throw err;
    } finally {
      // Remove loading state for this timer
      setLoadingTimers(prev => {
        const newLoading = new Set(prev);
        newLoading.delete(timerId);
        return newLoading;
      });
    }
  };

  // Cleanup continuous adjustment interval
  useEffect(() => {
    return () => {
      if (continuousAdjustmentInterval) {
        clearInterval(continuousAdjustmentInterval);
      }
    };
  }, [continuousAdjustmentInterval]);

  // Cleanup interval when popup closes
  useEffect(() => {
    if (!showEndTimerPopup) {
      stopContinuousAdjust();
    }
  }, [showEndTimerPopup]);

  // Show error state if employee info is not available
  if (!employeeCode || !employeeName) {
    return (
      <div className="time-tracking">
        <PageHeader 
          title="Time Tracking" 
          showProfile={true}
          currentEmployee={currentEmployee}
          onLogout={onLogout}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
        />
        <div className="jobs-content">
          <div className="control-section">
            <div className="simple-error">
              ❌ Employee information not available. Please log in again or contact your administrator.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="time-tracking">
        <PageHeader 
          title="Time Tracking" 
          showProfile={true}
          currentEmployee={currentEmployee}
          onLogout={onLogout}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
        />
        <div className="jobs-content">
          <div className="control-section">
            <div className="simple-error">
              ❌ {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter jobs based on search term
  const filteredJobs = jobs.filter(job => {
    if (!jobSearchTerm.trim()) return true;
    const searchLower = jobSearchTerm.toLowerCase();
    return job.jobNo.toLowerCase().includes(searchLower) || 
           job.jobName.toLowerCase().includes(searchLower);
  });

  // Handle job selection
  const handleJobSelect = (job) => {
    console.log('🎯 Selected Job Details:', {
      apiId: job.id, // This should be 13, 26, 39 from API
      jobCode: job.jobNo, // This should be "400", "401", "402" from API
      jobName: job.jobName, // This should be the job name from API
      status: job.status, // This should be "A", "C", "H" from API
      fullApiResponse: job.apiResponse // Complete API response object
    });
    
    setSelectedJob(job.id);
    setJobSearchTerm(`${job.jobNo} - ${job.jobName}`);
    setShowJobDropdown(false);
    
    // Clear previous account selection and fetch new accounts
    setSelectedAccount('');
    setAccountSearchTerm('');
    setAccounts([]);
    
    // Fetch job costing accounts for the selected job
    fetchJobCostingAccounts(job.jobNo);
  };

  // Fetch job costing accounts when a job is selected
  const fetchJobCostingAccounts = async (jobCode) => {
    if (!jobCode) return;
    
    try {
      setLoadingAccounts(true);
      
      
              const response = await fetch(`${getBackendUrl()}/job-costing-accounts/${jobCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAccounts(data.records || []);
          console.log(`✅ Loaded ${data.records.length} accounts for job ${jobCode}`);
        } else {
          console.error('Failed to fetch accounts:', data.error);
          setAccounts([]);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('❌ Error loading job costing accounts:', err);
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleStartTimer = async () => {
    if (selectedJob) {
      try {
        // Check if employee already has an active timer (not paused or completed)
        const employeeActiveTimers = activeTimers.filter(timer => 
          timer.employee_code === employeeCode && 
          timer.status === 'active' && 
          !pausedTimers.has(timer.id)
        );
        
        if (employeeActiveTimers.length > 0) {
          const activeCount = employeeActiveTimers.length;
          showError(`You already have ${activeCount} active timer${activeCount > 1 ? 's' : ''} running. Please pause or stop the existing timer${activeCount > 1 ? 's' : ''} first.`);
          return;
        }

        // Get GPS location data when starting timer
        let locationData = null;
        
        try {
          locationData = await captureGPSLocation('start timer');
          console.log('✅ GPS location captured for start timer:', locationData);
          
          // Show accuracy feedback to user
          const accuracyMessage = `GPS accuracy: ${locationData.accuracy_description}`;
          
          if (locationData.accuracy_status === 'excellent' || locationData.accuracy_status === 'good') {
            showSuccess(`✅ ${accuracyMessage}`);
          } else if (locationData.accuracy_status === 'acceptable') {
            showSuccess(`⚠️ ${accuracyMessage} - This should be sufficient for work tracking.`);
            } else {
            showSuccess(`⚠️ ${accuracyMessage} - Consider moving to a better location for improved accuracy.`);
          }
          
        } catch (locationError) {
          console.error('❌ Failed to get GPS location for start timer:', locationError);
          showError(`Failed to get location: ${locationError.message}. Please ensure location permissions are enabled.`);
          return; // Don't start timer without location
        }

        // Get selected job details

        
        const selectedJobData = jobs.find(job => {
          const match = job.id === selectedJob || 
                       job.id === parseInt(selectedJob) || 
                       job.id === selectedJob.toString();
          if (match) {
            console.log('✅ Found job data:', { jobId: job.id, jobNo: job.jobNo, jobName: job.jobName });
          }
          return match;
        });
        


        // Check if there's already a paused timer for the same job (to avoid confusion)
        const existingPausedTimer = activeTimers.find(timer => 
          timer.employee_code === employeeCode && 
          timer.job_no === (selectedJobData?.jobNo || selectedJob) &&
          pausedTimers.has(timer.id)
        );
        
        if (existingPausedTimer) {
          showError(`You already have a paused timer for job ${existingPausedTimer.job_no}. Please resume or stop that timer first.`);
          return;
        }


        
        const selectedAccountData = selectedAccount ? accounts.find(acc => 
          acc.id === selectedAccount || 
          acc.id === parseInt(selectedAccount) || 
          acc.id === selectedAccount.toString()
        ) : null;


        // Create time entry data using logged-in employee info
        const entryData = {
          job_no: selectedJobData?.jobNo || selectedJob,
          job_name: selectedJobData?.jobName || 'Unknown Job',
          employee_code: employeeCode,
          employee_name: employeeName,
          account_no: selectedAccountData?.accountNo || null,
          account_name: selectedAccountData?.name || null,
          comment: comment || null,
          status: 'active',
          spire_status: 'new',
          start_location: locationData // Save start location when timer starts
        };


        
        // Show location status to user
        if (locationData) {
          showSuccess(`Timer started! Start location saved (${locationData.accuracy}m accuracy)`);
        } else {
          showError('Timer started without location data. Please check your GPS settings.');
        }
        
        const result = await timeTrackingService.createEntry(entryData);
        
        if (result.success) {

          
          // Add to active timers
          const newTimer = {
            id: result.data.id,
            job_no: selectedJobData?.jobNo || selectedJob,
            job_name: selectedJobData?.jobName || 'Unknown Job',
            employee_code: employeeCode,
            employee_name: employeeName,
            account_no: selectedAccountData?.accountNo || null,
            account_name: selectedAccountData?.name || null,
            comment: comment,
            status: 'active', // Ensure status is 'active' for new timers
            total_seconds: 0, // Initialize total_seconds for new timers
            startTime: new Date(),
            elapsedTime: 0
          };

          setActiveTimers([...activeTimers, newTimer]);
          
          // Clear the form after starting timer
          clearForm();
          

        } else {
          throw new Error(result.error || 'Failed to create time entry');
        }
      } catch (err) {
        console.error('❌ Error starting timer:', err);
        alert(`Failed to start timer: ${err.message}`);
      }
    } else {
      alert('Please select a job to start timing.');
    }
  };

  // Clear form function
  const clearForm = () => {
    setSelectedJob('');
    setSelectedAccount('');
    setComment('');
    setJobSearchTerm('');
    setAccountSearchTerm('');
    setShowJobDropdown(false);
    setShowAccountDropdown(false);
    setFavoriteAccountInfo(null);
    
  };

  const handleStopTimer = async (timerId) => {
    // Find the timer to show in popup
    const timer = activeTimers.find(t => t.id === timerId);
    if (!timer) {
      showError('Timer not found');
      return;
    }
    
    // Set the selected timer and show popup
    setSelectedTimerForEnd(timer);
    
    // Calculate the correct accumulated time that matches the timer display
    let totalSeconds;
    
    if (pausedTimers.has(timerId)) {
      // If timer is paused, use the stored total_seconds (already accurate)
      totalSeconds = timer.total_seconds || 0;
      console.log('⏸️ Timer is paused, using stored total_seconds:', totalSeconds);
    } else {
      // If timer is active, calculate current accumulated time
      const currentElapsedSeconds = Math.floor(timer.elapsedTime / 1000);
      totalSeconds = currentElapsedSeconds;
      console.log('▶️ Timer is active, calculated current elapsed time:', currentElapsedSeconds);
    }
    
    // Convert to HH:MM:SS format
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const totalTimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    console.log('📊 Timer display shows:', formatTime(timer.elapsedTime));
    console.log('📊 Popup will show:', totalTimeString);
    console.log('📊 Total seconds calculated:', totalSeconds);
    
    setEndTotalTime(totalTimeString);
    setEndComment(timer.comment || ''); // Pre-fill with existing comment
    setShowEndTimerPopup(true);
  };

  const handleConfirmEndTimer = async () => {
    if (!selectedTimerForEnd) return;
    
    try {
      setEndTimerLoading(true);
      console.log('🛑 Confirming end timer:', selectedTimerForEnd.id);
      console.log('🛑 Timer details:', {
        id: selectedTimerForEnd.id,
        status: selectedTimerForEnd.status,
        total_seconds: selectedTimerForEnd.total_seconds,
        elapsedTime: selectedTimerForEnd.elapsedTime
      });
      
      // Parse the total time from the form
      const [hours, minutes, seconds] = endTotalTime.split(':').map(Number);
      const totalSeconds = (hours * 3600) + (minutes * 60) + (seconds || 0);
      
      console.log('🛑 Form time parsed:', { hours, minutes, seconds, totalSeconds });
      
      // Get GPS location data for the end timer
      let endLocationData = null;
      
      try {
        endLocationData = await captureGPSLocation('end timer');
        console.log('✅ GPS location captured for end timer:', endLocationData);
      } catch (locationError) {
        console.error('❌ Failed to get GPS location for end timer:', locationError);
        showError(`Failed to get location: ${locationError.message}. Please ensure location permissions are enabled.`);
        return; // Don't end timer without location
      }
      
      console.log('🛑 Calling updateTimer with end operation and location data...');
      
      // Use unified function to end timer with location data
      await updateTimer(selectedTimerForEnd.id, 'end', {
        totalSeconds: totalSeconds,
        comment: endComment,
        endLocation: endLocationData
      });
      
      console.log('✅ updateTimer completed successfully');
      
    } catch (err) {
      // Error handling is done in updateTimer function
      console.error('❌ Error in handleConfirmEndTimer:', err);
    } finally {
      setEndTimerLoading(false);
    }
  };

  const handleCloseEndTimerPopup = () => {
    setShowEndTimerPopup(false);
    setSelectedTimerForEnd(null);
    setEndTotalTime('');
    setEndComment('');
  };

  /**
   * Handle pause/resume timer with improved time tracking
   * 
   * NEW LOGIC: 
   * - When pausing: update start_time to pause time, store total_seconds
   * - When resuming: update start_time to resume time, keep total_seconds
   * 
   * This ensures accurate time calculation after refresh:
   * 
   * Formula: elapsedTime = total_seconds + (current_time - start_time)
   * 
   * Example:
   * 1. Start at 10:00:00, run for 1 min, pause at 10:01:00
   *    - start_time becomes 10:01:00, total_seconds = 60
   * 2. Wait 3 min, resume at 10:04:00
   *    - start_time becomes 10:04:00, total_seconds = 60
   * 3. Run for 2 min, current time 10:06:00
   *    - elapsedTime = 60 + (10:06:00 - 10:04:00) = 60 + 120 = 180 seconds (3 min) ✅
   */
  const handlePauseTimer = async (timerId) => {
    try {
      const isCurrentlyPaused = pausedTimers.has(timerId);
      const operation = isCurrentlyPaused ? 'resume' : 'pause';
      
      await updateTimer(timerId, operation);
    } catch (err) {
      // Error handling is done in updateTimer function
      console.error('❌ Error in handlePauseTimer:', err);
    }
  };

  const handleClearForm = () => {
    setSelectedJob('');
    setSelectedAccount('');
    setComment('');
    setJobSearchTerm('');
    setAccountSearchTerm('');
    setShowJobDropdown(false);
    setShowAccountDropdown(false);
    setAccounts([]);
  };

  // Helper function to format time from milliseconds to HH:MM:SS
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const adjustTime = (minutes) => {
    // Prevent rapid multiple adjustments
    if (isAdjusting) {
      console.log('🚫 Adjustment already in progress, skipping...');
      return;
    }
    
    try {
      setIsAdjusting(true);
      console.log(`⏰ Adjusting time by ${minutes} minutes. Current time: ${endTotalTime}`);
      
      const [hours, mins, seconds] = endTotalTime.split(':').map(Number);
      let totalMinutes = (hours * 60) + mins + minutes;
      
      console.log(`📊 Time calculation: ${hours}h ${mins}m + ${minutes}m = ${totalMinutes} total minutes`);
      
      // Ensure total minutes doesn't go below 0
      if (totalMinutes < 0) {
        totalMinutes = 0;
        console.log('⚠️ Time adjusted to minimum: 00:00:00');
      }
      
      // Ensure total minutes doesn't exceed 23:59:59 (1439 minutes)
      if (totalMinutes > 1439) {
        totalMinutes = 1439;
        console.log('⚠️ Time adjusted to maximum: 23:59:59');
      }
      
      const newHours = Math.floor(totalMinutes / 60);
      const newMinutes = totalMinutes % 60;
      
      const newTimeString = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      console.log(`✅ New time: ${newTimeString}`);
      setEndTotalTime(newTimeString);
      
      // Add visual feedback animation
      const timeInput = document.querySelector('.time-input');
      if (timeInput) {
        timeInput.classList.add('time-adjusted');
        setTimeout(() => {
          timeInput.classList.remove('time-adjusted');
        }, 300);
      }
      
      // Reset the adjusting flag after a short delay
      setTimeout(() => {
        setIsAdjusting(false);
      }, 50);
      
    } catch (error) {
      console.error('❌ Error adjusting time:', error);
      // If there's an error parsing the current time, set a default
      setEndTotalTime('00:10:00');
      setIsAdjusting(false);
    }
  };

  const startContinuousAdjust = (minutes) => {
    if (continuousAdjustmentInterval) {
      clearInterval(continuousAdjustmentInterval);
    }
    
    setActiveAdjustment(minutes);
    
    // Add a delay before starting continuous adjustment to prevent conflicts with single clicks
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        console.log(`🔄 Continuous adjustment: ${minutes} minutes`);
        adjustTime(minutes);
      }, 200); // Slower interval (200ms instead of 100ms)
      
      setContinuousAdjustmentInterval(interval);
    }, 300); // 300ms delay before starting continuous adjustment
    
    // Store the delay timeout to clear it if needed
    return delay;
  };

  const stopContinuousAdjust = () => {
    if (continuousAdjustmentInterval) {
      clearInterval(continuousAdjustmentInterval);
      setContinuousAdjustmentInterval(null);
    }
    setActiveAdjustment(0);
  };

  const handleAddTime = () => {

    
    if (!selectedJob || !selectedAccount) {
      showError('Please select both a job and account before adding time');
      return;
    }
    
    // Check if jobs and accounts data is available
    if (!jobs || jobs.length === 0) {
      showError('Jobs data is not loaded yet. Please wait and try again.');
      return;
    }
    
    if (!accounts || accounts.length === 0) {
      showError('Accounts data is not loaded yet. Please wait and try again.');
          return;
        }
        

    
    // Verify that the selected job and account actually exist in the data
    const selectedJobData = jobs.find(job => {
      // Handle both string and number ID types
      const match = job.id === selectedJob || 
                   job.id === parseInt(selectedJob) || 
                   job.id === selectedJob.toString();
      if (match) {
        console.log('✅ Found matching job:', { jobId: job.id, jobType: typeof job.id, selectedId: selectedJob, selectedType: typeof selectedJob });
      }
      return match;
    });
    
    const selectedAccountData = accounts.find(account => {
      // Handle both string and number ID types
      const match = account.id === selectedAccount || 
                   account.id === parseInt(selectedAccount) || 
                   account.id === selectedAccount.toString();
      if (match) {
        console.log('✅ Found matching account:', { accountId: account.id, accountType: typeof account.id, selectedId: selectedAccount, selectedType: typeof selectedAccount });
      }
      return match;
    });
    
    if (!selectedJobData) {
      console.error('❌ Job not found. Selected:', selectedJob, 'Available:', jobs.map(j => j.id));
      showError('Selected job not found in jobs data. Please select a job again.');
      return;
    }
    
    if (!selectedAccountData) {
      console.error('❌ Account not found. Selected:', selectedAccount, 'Available:', accounts.map(a => a.id));
      showError('Selected account not found in accounts data. Please select an account again.');
      return;
    }
    
    
    
    // Pre-fill the popup with current form data
    setAddTimeHours('');
    setAddTimeMinutes('');
    setShowAddTimePopup(true);
  };

  const handleConfirmAddTime = async () => {
    if (!addTimeHours && !addTimeMinutes) {
      showError('Please enter at least some time (hours or minutes)');
      return;
    }
    
    try {
      setAddTimeLoading(true);
      
      // Convert hours and minutes to total seconds
      const hours = parseInt(addTimeHours) || 0;
      const minutes = parseInt(addTimeMinutes) || 0;
      const totalSeconds = (hours * 3600) + (minutes * 60);
      
      if (totalSeconds === 0) {
        showError('Please enter a valid time greater than 0');
        return;
      }
      
      // Find the selected job and account details using the same robust logic
      const selectedJobData = jobs.find(job => {
        return job.id === selectedJob || 
               job.id === parseInt(selectedJob) || 
               job.id === selectedJob.toString();
      });
      
      const selectedAccountData = accounts.find(account => {
        return account.id === selectedAccount || 
               account.id === parseInt(selectedAccount) || 
               account.id === selectedAccount.toString();
      });
      
      if (!selectedJobData || !selectedAccountData) {
        showError('Job or account information not found');
        return;
      }
      
      // Get GPS location data for the time entry
      let locationData = null;
      
      try {
        locationData = await captureGPSLocation('add time entry');

      } catch (locationError) {
        console.error('❌ Failed to get GPS location for Add Time:', locationError);
        showError(`Failed to get location: ${locationError.message}. Please ensure location permissions are enabled.`);
        return; // Don't create time entry without location
      }
      

      
      // Validate required fields
      if (!selectedJobData || !selectedJobData.jobNo) {
        showError('Job data is missing. Please select a job again.');
        return;
      }
      
      if (!selectedAccountData || !selectedAccountData.accountNo) {
        showError('Account data is missing. Please select an account again.');
        return;
      }
      
      if (!totalSeconds || totalSeconds <= 0) {
        showError('Please enter a valid time (hours and minutes).');
        return;
      }
      
      // Create the time entry data with complete information
      const timeEntryData = {
        job_no: selectedJobData.jobNo,
        job_name: selectedJobData.jobName,
        employee_code: employeeCode,
        employee_name: employeeName,
        account_no: selectedAccountData.accountNo,
        account_name: selectedAccountData.name,
        comment: comment || '',
        total_seconds: totalSeconds,
        status: 'completed', // Direct time entry is always completed
        start_location: locationData, // Include start location
        end_location: locationData,   // Include end location (same as start for manual entries)
        end_time: new Date()          // Set completion time
      };
      

      

      
      try {
        // Create the time entry
        const result = await timeTrackingService.createEntry(timeEntryData);
        
        if (result.success) {

          
          // Create success message
          showSuccess(
            <div>
              Time entry added: {hours}h {minutes}m for {selectedJobData.jobNo}
            </div>
          );
          
          // Close popup and clear form
          setShowAddTimePopup(false);
          clearForm();
      } else {
          throw new Error(result.error || 'Failed to create time entry');
        }
      } catch (apiError) {
        console.error('❌ API Error Details:', {
          message: apiError.message,
          status: apiError.status,
          response: apiError.response,
          stack: apiError.stack
        });
        throw apiError; // Re-throw to be caught by outer catch
      }
      
    } catch (err) {
      console.error('❌ Error creating manual time entry:', err);
      showError(`Failed to add time: ${err.message}`);
    } finally {
      setAddTimeLoading(false);
    }
  };

  const handleCloseAddTimePopup = () => {
    setShowAddTimePopup(false);
    setAddTimeHours('');
    setAddTimeMinutes('');
  };

  return (
    <div className="time-tracking">
      {/* Reusable Header */}
      <PageHeader 
        title="Time Tracking" 
        showProfile={true}
        currentEmployee={currentEmployee}
        onLogout={onLogout}
        showProfileDropdown={showProfileDropdown}
        setShowProfileDropdown={setShowProfileDropdown}
      />

      <div className="jobs-content">
        {/* Section 1: Start Timer */}
        <div className="control-section">
          <h2>Start Timer</h2>
          <div className="timer-form">
            <div className="form-group">
              <label>Select Job</label>
              <div className="searchable-dropdown">
                <input
                  type="text"
                  placeholder="Search jobs by number or name..."
                  value={jobSearchTerm}
                  onChange={(e) => {
                    setJobSearchTerm(e.target.value);
                    setShowJobDropdown(true);
                    if (!e.target.value) {
                      setSelectedJob('');
                    }
                  }}
                  onFocus={() => setShowJobDropdown(true)}
                  className="form-input"
                />
                {showJobDropdown && filteredJobs.length > 0 && (
                  <div className="dropdown-options">
                    {filteredJobs.map(job => (
                      <div
                        key={job.id}
                        className="dropdown-option"
                        onClick={() => handleJobSelect(job)}
                      >
                        <span className="job-number">{job.jobNo}</span>
                        <span className="separator">-</span>
                        <span className="job-name">{job.jobName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Job Costing Accounts Dropdown - Always visible */}
            <div className="form-group">
              <label>Select Account</label>
              <div className="searchable-dropdown">
                <input
                  type="text"
                  placeholder={!selectedJob ? "Select a job to load accounts..." : (loadingAccounts ? "Loading accounts..." : "Search accounts by number or name...")}
                  value={accountSearchTerm}
                  onChange={(e) => {
                    if (!selectedJob) return; // Don't allow input if no job selected
                    setAccountSearchTerm(e.target.value);
                    setShowAccountDropdown(true);
                    if (!e.target.value) {
                      setSelectedAccount('');
                    }
                  }}
                  onFocus={() => {
                    setShowAccountDropdown(true);
                  }}
                  className="form-input"
                  disabled={!selectedJob || loadingAccounts}
                />
                {showAccountDropdown && !selectedJob && (
                  <div className="dropdown-options">
                    <div className="dropdown-option no-job-selected">
                      <span>Select a job to load accounts</span>
                    </div>
                  </div>
                )}
                {showAccountDropdown && loadingAccounts && (
                  <div className="dropdown-options">
                    <div className="dropdown-option loading">
                      <span>Loading accounts...</span>
                    </div>
                  </div>
                )}
                {showAccountDropdown && !loadingAccounts && selectedJob && accounts.length > 0 && (
                  <div className="dropdown-options">
                    {accounts
                      .filter(account => {
                        if (!accountSearchTerm.trim()) return true;
                        const searchLower = accountSearchTerm.toLowerCase();
                        return account.code.toLowerCase().includes(searchLower) || 
                               account.name.toLowerCase().includes(searchLower) ||
                               account.accountNo.toLowerCase().includes(searchLower);
                      })
                      .map(account => (
                        <div
                          key={account.id}
                        className="dropdown-option"
                          onClick={() => handleAccountSelect(account)}
                      >
                          <span className="account-number">{account.accountNo}</span>
                        <span className="separator">-</span>
                          <span className="account-name">{account.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showAccountDropdown && !loadingAccounts && selectedJob && accounts.length === 0 && (
                  <div className="dropdown-options">
                    <div className="dropdown-option no-results">
                      <span>No accounts found for this job</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Comment</label>
              <div className="searchable-dropdown">
                <textarea
                placeholder="What are you working on?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                  className="form-textarea"
                  rows={3}
                  style={{
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}
              />
              </div>
            </div>

            <div className="form-buttons">
              <button
                onClick={handleStartTimer}
                disabled={!selectedJob || !selectedAccount}
                className="start-button"
              >
                Start
              </button>
              
              <button
                onClick={handleAddTime}
                disabled={!selectedJob || !selectedAccount}
                className="add-time-button"
              >
                Add
              </button>
              
              <button
                onClick={handleClearForm}
                type="button"
                className="clear-button"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Active Timers */}
        <div className="control-section active-timers">
          <h2>Active Timers ({activeTimers.filter(timer => timer.status === 'active' || timer.status === 'paused').length})</h2>
          {activeTimers.filter(timer => timer.status === 'active' || timer.status === 'paused').length === 0 ? (
            <div className="no-active-timers">
              <p>No active timers running. Start a timer to see it here.</p>
            </div>
          ) : (
            <div className="active-timers-grid">
              {activeTimers
                .filter(timer => timer.status === 'active' || timer.status === 'paused')
                .map((timer) => (
                <div key={timer.id} className="active-timer-card">
                  <div className="timer-info">
                    {/* Timer Status Badge - Now at the top */}
                    <div className="timer-status-badge">
                      {pausedTimers.has(timer.id) ? (
                        <span className="status-paused">⏸️ Paused</span>
                      ) : (
                        <span className="status-active">▶️ Active</span>
                      )}
                    </div>
                    <div className="timer-header">
                      <div className="timer-job">{timer.job_no} - {timer.job_name}</div>
                      <div className="timer-account">{timer.account_no} - {timer.account_name}</div>
                      <div className="timer-employee">{timer.employee_name}</div>
                      <div className="timer-comment">{timer.comment || 'No comment'}</div>
                    </div>
                  </div>
                  
                  <div className="timer-right">
                    <div>
                    <div className="timer-display">
                        <div className="timer-time">
                          {loadingTimers.has(timer.id) ? (
                            <span className="loading-spinner">⏳</span>
                          ) : (
                            pausedTimers.has(timer.id) 
                              ? formatTime(timer.total_seconds * 1000) // Show saved time when paused
                              : formatTime(timer.elapsedTime) // Show live time when active
                          )}
                        </div>
                        <div className="timer-label">
                          {loadingTimers.has(timer.id) 
                            ? 'Updating...' 
                            : (pausedTimers.has(timer.id) ? 'Paused Time' : 'Elapsed Time')
                          }
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="timer-buttons">
                        <button 
                          onClick={() => handlePauseTimer(timer.id)} 
                          className="pause-button"
                          title={pausedTimers.has(timer.id) ? "Resume Timer" : "Pause Timer"}
                          disabled={loadingTimers.has(timer.id) || 
                            (pausedTimers.has(timer.id) && 
                             activeTimers.some(t => t.status === 'active' && !pausedTimers.has(t.id)))
                          }
                        >
                          <span className="material-icons">
                            {pausedTimers.has(timer.id) ? 'play_arrow' : 'pause'}
                          </span>
                          <span className="button-text">
                            {pausedTimers.has(timer.id) ? 'Resume' : 'Pause'}
                          </span>
                        </button>
                    
                    <button 
                          className="stop-button"
                      onClick={() => handleStopTimer(timer.id)} 
                          disabled={loadingTimers.has(timer.id)}
                          title="End Timer"
                    >
                          <span className="material-icons">close</span>
                          <span className="button-text">End</span>
                    </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* End Timer Popup */}
        {showEndTimerPopup && selectedTimerForEnd && (
          <div className="popup-overlay" onClick={handleCloseEndTimerPopup}>
            <div className="end-timer-popup" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3>End Timer</h3>
                <button 
                  className="close-button" 
                  onClick={handleCloseEndTimerPopup}
                  title="Close"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
              
              <div className="popup-content">
                <div className="popup-field">
                  <label>Project Name</label>
                  <div className="readonly-value">
                    {selectedTimerForEnd.job_no} - {selectedTimerForEnd.job_name}
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Account</label>
                  <div className="readonly-value">
                    {selectedTimerForEnd.account_no} - {selectedTimerForEnd.account_name}
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Start Date</label>
                  <div className="readonly-value">
                    {selectedTimerForEnd.startTime ? 
                      selectedTimerForEnd.startTime.toLocaleDateString() : 
                      'Not available'
                    }
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Total Time (HH:MM:SS) - Use buttons to adjust</label>
                  <div className="time-input-container">
                    <button 
                      type="button"
                      className={`time-adjust-btn minus-btn ${activeAdjustment === -10 ? 'continuous-active' : ''}`}
                      onClick={() => {
                        console.log('🔘 Minus button clicked - single adjustment');
                        adjustTime(-10);
                      }}
                      onMouseDown={() => {
                        console.log('🔘 Minus button mouse down - starting continuous adjustment');
                        startContinuousAdjust(-10);
                      }}
                      onMouseUp={stopContinuousAdjust}
                      onMouseLeave={stopContinuousAdjust}
                      onTouchStart={() => startContinuousAdjust(-10)}
                      onTouchEnd={stopContinuousAdjust}
                      title="Decrease by 10 minutes (hold for continuous)"
                    >
                      <span className="material-icons">remove</span>
                    </button>
                    <input
                      type="text"
                      value={endTotalTime}
                      readOnly
                      className="time-input"
                      pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                    />
                    <button 
                      type="button"
                      className={`time-adjust-btn plus-btn ${activeAdjustment === 10 ? 'continuous-active' : ''}`}
                      onClick={() => {
                        console.log('🔘 Plus button clicked - single adjustment');
                        adjustTime(10);
                      }}
                      onMouseDown={() => {
                        console.log('🔘 Plus button mouse down - starting continuous adjustment');
                        startContinuousAdjust(10);
                      }}
                      onMouseUp={stopContinuousAdjust}
                      onMouseLeave={stopContinuousAdjust}
                      onTouchStart={() => startContinuousAdjust(10)}
                      onTouchEnd={stopContinuousAdjust}
                      title="Increase by 10 minutes (hold for continuous)"
                    >
                      <span className="material-icons">add</span>
                    </button>
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Comment</label>
                  <textarea
                    value={endComment}
                    onChange={(e) => setEndComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-textarea"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="popup-actions">
                <button 
                  className="cancel-button" 
                  onClick={handleCloseEndTimerPopup}
                  disabled={endTimerLoading}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button" 
                  onClick={handleConfirmEndTimer}
                  disabled={endTimerLoading}
                >
                  {endTimerLoading ? (
                    <span className="loading-spinner">⏳</span>
                  ) : (
                    'End Timer'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Time Popup */}
        {showAddTimePopup && (
          <div className="popup-overlay" onClick={handleCloseAddTimePopup}>
            <div className="add-time-popup" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3>Add Time</h3>
                <button 
                  className="close-button" 
                  onClick={handleCloseAddTimePopup}
                  title="Close"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
              
              <div className="popup-content">
                <div className="popup-field">
                  <label>Project Name</label>
                  <div className="readonly-value">
                    {(() => {
                      if (!selectedJob) return 'No job selected';
                      if (!jobs || jobs.length === 0) return 'Loading jobs...';
                      
                      // Use the same robust matching logic as handleAddTime
                      const selectedJobData = jobs.find(job => {
                        return job.id === selectedJob || 
                               job.id === parseInt(selectedJob) || 
                               job.id === selectedJob.toString();
                      });
                      

                      
                      if (!selectedJobData) return 'Job not found';
                      return `${selectedJobData.jobNo} - ${selectedJobData.jobName}`;
                    })()}
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Account</label>
                  <div className="readonly-value">
                    {(() => {
                      if (!selectedAccount) return 'No account selected';
                      if (!accounts || accounts.length === 0) return 'Loading accounts...';
                      
                      // Use the same robust matching logic as handleAddTime
                      const selectedAccountData = accounts.find(acc => {
                        return acc.id === selectedAccount || 
                               acc.id === parseInt(selectedAccount) || 
                               acc.id === selectedAccount.toString();
                      });
                      

                      
                      if (!selectedAccountData) return 'Account not found';
                      return `${selectedAccountData.accountNo} - ${selectedAccountData.name}`;
                    })()}
                  </div>
                </div>
                
                <div className="popup-field">
                  <label>Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-textarea"
                    rows={3}
                  />
                </div>
                
                <div className="popup-field">
                  <label>Time to Add (HH:MM)</label>
                  <div className="time-input-container">
                    <input
                      type="number"
                      value={addTimeHours}
                      onChange={(e) => setAddTimeHours(e.target.value)}
                      className="time-input"
                      placeholder="Hours"
                      min="0"
                      max="99"
                    />
                    <span>:</span>
                    <input
                      type="number"
                      value={addTimeMinutes}
                      onChange={(e) => setAddTimeMinutes(e.target.value)}
                      className="time-input"
                      placeholder="Minutes"
                      min="0"
                      max="59"
                    />
                  </div>
                </div>
              </div>
              
              <div className="popup-actions">
                <button 
                  className="cancel-button" 
                  onClick={handleCloseAddTimePopup}
                  disabled={addTimeLoading}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button" 
                  onClick={handleConfirmAddTime}
                  disabled={addTimeLoading}
                >
                  {addTimeLoading ? (
                    <span className="loading-spinner">⏳</span>
                  ) : (
                    'Add Time'
                  )}
                </button>
              </div>
              
              {/* Show simple loading status */}
              {addTimeLoading && (
                <div className="popup-loading-status">
                  <div className="loading-message">
                    <span className="loading-spinner">⏳</span>
                    <span>Processing...</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TimeTracking;
