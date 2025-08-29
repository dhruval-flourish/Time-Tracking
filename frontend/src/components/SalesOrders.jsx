import React, { useState, useMemo, useEffect } from 'react';
import PageHeader from './PageHeader.jsx';
import { useAuth } from '../contexts/AuthContext';
import config, { getBackendUrl } from '../config/app-config.js';

const SalesOrders = ({ currentEmployee, onLogout, showProfileDropdown, setShowProfileDropdown, setCurrentPage }) => {
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [starredJobs, setStarredJobs] = useState(new Set());
  
  // Account popup state
  const [showAccountPopup, setShowAccountPopup] = useState(false);
  const [selectedJobForAccount, setSelectedJobForAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (showAccountPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAccountPopup]);

  // Load existing favorites when component mounts and jobs are loaded
  useEffect(() => {
    if (isAuthenticated && currentEmployee?.emp_code && jobs.length > 0) {
      loadUserFavorites();
    }
  }, [isAuthenticated, currentEmployee, jobs]);

  const loadUserFavorites = async () => {
    try {
              const response = await fetch(`${getBackendUrl()}/users/${currentEmployee.emp_code}/favorites`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Create a set of starred job IDs from favorites
          const favoriteJobIds = new Set();
          data.favorites.forEach(fav => {
            // Find the job by job_no and add its ID to starred jobs
            const job = jobs.find(j => j.jobNo === fav.job_no);
            if (job) {
              favoriteJobIds.add(job.id);
              console.log(`⭐ Auto-starred job: ${fav.job_no} - ${fav.job_name}`);
            } else {
              console.log(`⚠️ Job not found in current jobs list: ${fav.job_no}`);
            }
          });
          setStarredJobs(favoriteJobIds);
          console.log('✅ Loaded user favorites:', data.favorites);
          console.log('🌟 Starred job IDs:', Array.from(favoriteJobIds));
        }
      }
    } catch (error) {
      console.error('❌ Error loading favorites:', error);
    }
  };



  // Fetch jobs from local backend API
  useEffect(() => {
    console.log('🔐 SalesOrders useEffect - isAuthenticated:', isAuthenticated);
    if (!isAuthenticated) {
      console.log('⏳ SalesOrders waiting for authentication...');
      return; // Only fetch if authenticated
    }
    
    const loadJobs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🚀 Fetching jobs from local API server...');
        
        // Use local backend API endpoint - no search parameter needed
        const apiUrl = `${getBackendUrl()}/jobs`;
        console.log('🔗 API URL:', apiUrl);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const jobsData = await response.json();
        console.log('📊 API Response:', jobsData);
        
        // Transform API data to match our ORIGINAL component structure
        const transformedJobs = (jobsData.records || []).map(job => ({
          id: job.id || job.code,
          jobNo: job.code || job.orderNo || `JOB-${job.id}`,
          jobName: job.name || job.description || 'Unnamed Job',
          status: job.status || 'Unknown'
          // Removed: company, startDate, endDate - keeping original format
        }));
        
        setJobs(transformedJobs);
        console.log(`✅ Successfully loaded ${transformedJobs.length} jobs from API`);
      } catch (err) {
        console.error('❌ Error loading jobs:', err);
        
        // Determine error type
        let errorMessage = 'Failed to load jobs';
        if (err.name === 'AbortError') {
          errorMessage = 'Request timeout - API server is not responding';
        } else if (err.message.includes('fetch')) {
          errorMessage = 'Network error - Cannot connect to API server';
        } else if (err.message.includes('HTTP')) {
          errorMessage = err.message;
        } else {
          errorMessage = `Unexpected error: ${err.message}`;
        }
        
        setError(errorMessage);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };



    loadJobs();
  }, [isAuthenticated]); // Add isAuthenticated as dependency

  // Filter and sort jobs based on search term and favorites
  const filteredJobs = useMemo(() => {
    let filtered = jobs;
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = jobs.filter(job => 
        job.jobNo.toLowerCase().includes(searchLower) ||
        job.jobName.toLowerCase().includes(searchLower)
        // Removed company search - keeping original format
      );
    }
    
    // Sort: favorited jobs first, then by job number (natural order)
    filtered.sort((a, b) => {
      const aIsFavorited = starredJobs.has(a.id);
      const bIsFavorited = starredJobs.has(b.id);
      
      // If one is favorited and the other isn't, favorited comes first
      if (aIsFavorited && !bIsFavorited) return -1;
      if (!aIsFavorited && bIsFavorited) return 1;
      
      // If both are favorited or both are not, sort by job number in natural order
      return a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    return filtered;
  }, [jobs, searchTerm, starredJobs]);

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

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Get status pill color and display text
  const getStatusInfo = (status) => {
    switch (status?.toUpperCase()) {
      case 'A':
        return { color: 'status-progress', text: 'Active' };
      case 'C':
        return { color: 'status-completed', text: 'Completed' };
      case 'H':
        return { color: 'status-pending', text: 'Hold' };
      default:
        return { color: 'status-default', text: status || 'Unknown' };
    }
  };



  const handleStarClick = async (job) => {
    setSelectedJobForAccount(job);
    setSelectedAccount('');
    setAccountSearchTerm('');
    setShowAccountDropdown(false);
    setPopupLoading(true);
    setShowAccountPopup(true);
    
    try {
      // Check if this job is already favorited and get account info
      if (starredJobs.has(job.id)) {
        const response = await fetch(`${getBackendUrl()}/users/${currentEmployee.emp_code}/favorites`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const existingFavorite = data.favorites.find(fav => fav.job_no === job.jobNo);
            if (existingFavorite) {
              // Auto-fill the account information
              setSelectedAccount(existingFavorite.acc_no);
              setAccountSearchTerm(`${existingFavorite.acc_no} - ${existingFavorite.acc_name}`);
              console.log('✅ Auto-filled account from favorite:', existingFavorite);
            }
          }
        }
      }
      
      // Fetch job costing accounts
      await fetchJobCostingAccounts(job.jobNo);
    } catch (error) {
      console.error('❌ Error loading popup data:', error);
    } finally {
      setPopupLoading(false);
    }
  };

  const handleAccountSelect = (account) => {
    setSelectedAccount(account.accountNo);
    setAccountSearchTerm(`${account.accountNo} - ${account.name}`);
    setShowAccountDropdown(false);
  };

  const handleSaveFavorite = async () => {
    if (selectedAccount && selectedJobForAccount) {
      setSaveLoading(true);
      try {
        // Find the selected account details
        const selectedAccountDetails = accounts.find(acc => acc.accountNo === selectedAccount);
        
        if (!selectedAccountDetails) {
          console.error('❌ Selected account not found in accounts list');
          return;
        }

        // Prepare favorite data
        const favoriteData = {
          job_no: selectedJobForAccount.jobNo,
          job_name: selectedJobForAccount.jobName,
          acc_no: selectedAccountDetails.accountNo,
          acc_name: selectedAccountDetails.name
        };

        console.log('💾 Saving/updating favorite to database:', favoriteData);

        // Save to database using user store
        const response = await fetch(`${getBackendUrl()}/users/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            emp_code: currentEmployee.emp_code,
            favorite: favoriteData
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log('✅ Favorite saved/updated successfully');
            // Add to starred jobs if not already there
            if (!starredJobs.has(selectedJobForAccount.id)) {
              setStarredJobs(prev => new Set([...prev, selectedJobForAccount.id]));
            }
            // Close popup
            setShowAccountPopup(false);
            setSelectedJobForAccount(null);
            setSelectedAccount('');
            setAccountSearchTerm('');
          } else {
            console.error('❌ Failed to save/update favorite:', result.error);
          }
        } else {
          console.error('❌ HTTP error saving/updating favorite:', response.status);
        }
      } catch (error) {
        console.error('❌ Error saving/updating favorite:', error);
      } finally {
        setSaveLoading(false);
      }
    }
  };

  const handleRemoveFavorite = async () => {
    if (selectedJobForAccount) {
      setRemoveLoading(true);
      try {
        const response = await fetch(`${getBackendUrl()}/users/favorites`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            emp_code: currentEmployee.emp_code,
            job_no: selectedJobForAccount.jobNo
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log('✅ Favorite removed successfully');
            // Remove from starred jobs
            setStarredJobs(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedJobForAccount.id);
              return newSet;
            });
            // Close popup
            setShowAccountPopup(false);
            setSelectedJobForAccount(null);
            setSelectedAccount('');
            setAccountSearchTerm('');
          } else {
            console.error('❌ Failed to remove favorite:', result.error);
          }
        } else {
          console.error('❌ HTTP error removing favorite:', response.status);
        }
      } catch (error) {
        console.error('❌ Error removing favorite:', error);
      } finally {
        setRemoveLoading(false);
      }
    }
  };

  const handleClosePopup = () => {
    setShowAccountPopup(false);
    setSelectedJobForAccount(null);
    setSelectedAccount('');
    setAccountSearchTerm('');
    setShowAccountDropdown(false);
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e) => {
    if (!e.target.closest('.searchable-dropdown')) {
      setShowAccountDropdown(false);
    }
  };

  // Handle card click to navigate to TimeTracking
  const handleCardClick = async (job) => {
    // Store job number, job ID, and job name in localStorage for TimeTracking to access
    console.log('🖱️ Job card clicked:', job);
    localStorage.setItem('selectedJobNo', job.jobNo);
    localStorage.setItem('selectedJobId', job.id);
    localStorage.setItem('selectedJobName', job.jobName);
    
    // Check if this job is favorited and get account info
    if (starredJobs.has(job.id)) {
      try {

        
        const response = await fetch(`${getBackendUrl()}/users/${currentEmployee.emp_code}/favorites`);
        if (response.ok) {
          const data = await response.json();

          
          if (data.success) {
            const existingFavorite = data.favorites.find(fav => fav.job_no === job.jobNo);

            
            if (existingFavorite) {
              // Store account information as well
              localStorage.setItem('selectedAccountNo', existingFavorite.acc_no);
              localStorage.setItem('selectedAccountName', existingFavorite.acc_name);

            } else {
              console.log('⚠️ Job not found in favorites despite being starred');

            }
          }
        }
      } catch (error) {
        console.error('❌ Error getting account from favorites:', error);
      }
    } else {
      console.log('ℹ️ Job not favorited, no account info to fetch');
    }
    
    // Navigate to TimeTracking
    setCurrentPage('time');
  };

  if (loading) {
    return (
      <div className="active-jobs">
        {/* Header */}
        <PageHeader 
          title="Active Jobs" 
          showProfile={true}
          currentEmployee={currentEmployee}
          onLogout={onLogout}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
        />
        <div className="jobs-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading jobs from API server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="active-jobs">
        <PageHeader 
          title="Active Jobs" 
          showProfile={true}
          currentEmployee={currentEmployee}
          onLogout={onLogout}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
        />
        <div className="jobs-content">
          <div className="simple-error">
            ❌ {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="active-jobs">


      {/* Header for filtered results */}
      <PageHeader 
        title="Active Jobs" 
        showProfile={true}
        currentEmployee={currentEmployee}
        onLogout={onLogout}
        showProfileDropdown={showProfileDropdown}
        setShowProfileDropdown={setShowProfileDropdown}
      />



      <div className="jobs-content">
        {/* Search Bar */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search jobs by number or name"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <span className="search-icon">🔍</span>
          </div>
          

        </div>



        {/* Mobile Jobs Grid */}

        <div className="mobile-jobs-grid">
          {filteredJobs.map((job) => (
            <div 
              key={job.id} 
              className={`mobile-job-card ${starredJobs.has(job.id) ? 'favorited' : ''}`}
              onClick={() => handleCardClick(job)}
            >

              
              <div className="card-content-wrapper">
                {/* Star Icon at Start - Always visible */}
                <div className="star-container" onClick={(e) => {
                  e.stopPropagation();
                  handleStarClick(job); // Always show popup for both favorited and non-favorited jobs
                }}>
                  <span className={`material-icons star-icon ${starredJobs.has(job.id) ? 'starred' : 'unstarred'}`}>
                    {starredJobs.has(job.id) ? 'star' : 'star_outline'}
                  </span>
                  {/* Debug: Show text if Material Icons fail */}
                  <span className="star-text" style={{ display: 'none' }}>
                    {starredJobs.has(job.id) ? '★' : '☆'}
                  </span>

                </div>
                
                {/* Job Content */}
                <div className="job-content">
                  <div className="mobile-job-header">
                    <h3 className="mobile-job-title">{job.jobName}</h3>
                    <span className={`mobile-job-status ${getStatusInfo(job.status).color}`}>
                      {getStatusInfo(job.status).text}
                    </span>
                  </div>
                  <div className="mobile-job-details">
                    <div className="mobile-job-detail">
                      <span className="mobile-job-label">Job #:</span>
                      <span className="mobile-job-value">{job.jobNo}</span>
                    </div>
                    {/* Removed company, start date, end date - keeping original format */}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Results Message */}
        {filteredJobs.length === 0 && !loading && (
          <div className="no-results">
            <p>No jobs found matching your search criteria.</p>
          </div>
        )}
      </div>

      {/* Account Selection Popup */}
      {showAccountPopup && (
        <div className="popup-backdrop" onClick={handleClosePopup}>
          <div className="account-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>{starredJobs.has(selectedJobForAccount?.id) ? 'Edit or Remove Favorite' : 'Add to Favorites'}</h3>
              <button className="close-popup" onClick={handleClosePopup}>
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="popup-content">
              {popupLoading && (
                <div className="popup-loading-overlay">
                  <div className="popup-loading-spinner"></div>
                  <p>Loading account information...</p>
                </div>
              )}
              {starredJobs.has(selectedJobForAccount?.id) && selectedAccount && (
                <div style={{ 
                  background: '#e8f5e8', 
                  padding: '8px 12px', 
                  borderRadius: '5px', 
                  marginBottom: '15px',
                  fontSize: '12px',
                  color: '#2d5a2d'
                }}>
                  ℹ️ Account auto-filled from existing favorite
                </div>
              )}
              <div className="form-group">
                <label>Select Account</label>
                <div className="searchable-dropdown">
                  <input
                    type="text"
                    placeholder={loadingAccounts ? "Loading accounts..." : "Search accounts by number or name..."}
                    value={accountSearchTerm}
                    onChange={(e) => {
                      setAccountSearchTerm(e.target.value);
                      setShowAccountDropdown(true);
                      if (!e.target.value) {
                        setSelectedAccount('');
                      }
                    }}
                    onFocus={() => setShowAccountDropdown(true)}
                    onBlur={() => {
                      // Small delay to allow click on dropdown options
                      setTimeout(() => setShowAccountDropdown(false), 150);
                    }}
                    className="form-input"
                    disabled={loadingAccounts}
                  />
                  
                  {showAccountDropdown && loadingAccounts && (
                    <div className="dropdown-options">
                      <div className="dropdown-option loading">
                        <span>Loading accounts...</span>
                      </div>
                    </div>
                  )}
                  
                  {showAccountDropdown && !loadingAccounts && accounts.length > 0 && (
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
                  
                  {showAccountDropdown && !loadingAccounts && accounts.length === 0 && (
                    <div className="dropdown-options">
                      <div className="dropdown-option no-results">
                        <span>No accounts found for this job</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="popup-buttons">
                {starredJobs.has(selectedJobForAccount?.id) ? (
                  <>
                    <button
                      onClick={handleSaveFavorite}
                      disabled={!selectedAccount || saveLoading}
                      className="save-button"
                    >
                      {saveLoading ? (
                        <>
                          <div className="button-loading-spinner"></div>
                          Updating...
                        </>
                      ) : (
                        'Update Favorite'
                      )}
                    </button>
                    <button
                      onClick={handleRemoveFavorite}
                      disabled={removeLoading}
                      className="remove-button"
                    >
                      {removeLoading ? (
                        <>
                          <div className="button-loading-spinner"></div>
                          Removing...
                        </>
                      ) : (
                        'Remove from Favorites'
                      )}
                    </button>
                    <button
                      onClick={handleClosePopup}
                      disabled={saveLoading || removeLoading}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveFavorite}
                      disabled={!selectedAccount || saveLoading}
                      className="save-button"
                    >
                      {saveLoading ? (
                        <>
                          <div className="button-loading-spinner"></div>
                          Saving...
                        </>
                      ) : (
                        'Save Favorite'
                      )}
                    </button>
                    <button
                      onClick={handleClosePopup}
                      disabled={saveLoading}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesOrders;
