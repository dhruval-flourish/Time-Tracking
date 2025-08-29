import React, { useState, useEffect } from 'react';
import timeTrackingService from '../services/timeTrackingService.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';
import PageHeader from './PageHeader.jsx';
import './Recent.css';

const Recent = ({ currentEmployee, onLogout, showProfileDropdown, setShowProfileDropdown }) => {
  const [recentEntries, setRecentEntries] = useState([]);
  const [groupedEntries, setGroupedEntries] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState('');
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [expandedEntryInfo, setExpandedEntryInfo] = useState(null);
  const { isAuthenticated } = useAuth();
  const { success, error } = useToast();

  // Get current week dates
  const getCurrentWeekDates = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek, endOfWeek };
  };

  // Format date for display - just day name
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };



  // Format duration dynamically - smart display showing max 2 time units
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    // Build the time string with max 2 units
    let timeString = '';
    let unitCount = 0;
    
    if (hours > 0) {
      timeString += `${hours}h`;
      unitCount++;
      
      if (minutes > 0 && unitCount < 2) {
        timeString += ` ${minutes}m`;
        unitCount++;
      }
    } else if (minutes > 0) {
      timeString += `${minutes}m`;
      unitCount++;
      
      if (remainingSeconds > 0 && unitCount < 2) {
        timeString += ` ${remainingSeconds}s`;
        unitCount++;
      }
    } else {
      timeString = `${remainingSeconds}s`;
    }
    
    return timeString;
  };

  // Group entries by date
  const groupEntriesByDate = (entries) => {
    const grouped = {};
    
    entries.forEach(entry => {
      const dateKey = formatDate(entry.start_time);
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          totalTime: 0,
          entries: []
        };
      }
      
      grouped[dateKey].totalTime += entry.total_seconds || 0;
      grouped[dateKey].entries.push(entry);
    });
    
    return grouped;
  };

  // Calculate total time for the week
  const calculateTotalWeekTime = () => {
    return recentEntries.reduce((total, entry) => {
      return total + (entry.total_seconds || 0);
    }, 0);
  };

  // Fetch recent entries for the current week
  const fetchRecentEntries = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const { startOfWeek, endOfWeek } = getCurrentWeekDates();
      
      // Get all entries and filter by current week and completed status
      const result = await timeTrackingService.getAllEntries();
      
      if (result.success) {
        const allEntries = result.data || [];
        const weekEntries = allEntries.filter(entry => {
          const entryDate = new Date(entry.start_time);
          const isInWeek = entryDate >= startOfWeek && entryDate <= endOfWeek;
          const isCompleted = entry.status === 'completed' || entry.end_time !== null;
          return isInWeek && isCompleted;
        });
        
        // Sort by most recent first
        weekEntries.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        
        setRecentEntries(weekEntries);
        setGroupedEntries(groupEntriesByDate(weekEntries));
        
        // Set current week display string
        const weekStart = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekEnd = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setCurrentWeek(`${weekStart} - ${weekEnd}`);
        
        console.log(`✅ Loaded ${weekEntries.length} completed entries for current week`);
      } else {
        console.error('Failed to fetch recent entries:', result.error);
        error('Failed to load recent entries');
      }
    } catch (err) {
      console.error('❌ Error loading recent entries:', err);
      error('Error loading recent entries');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle project expansion
  const toggleProjectExpansion = (projectName) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  // Toggle entry info popup
  const toggleEntryInfo = (entryId) => {
    setExpandedEntryInfo(expandedEntryInfo === entryId ? null : entryId);
  };

  // Refresh data
  const refreshData = () => {
    fetchRecentEntries();
    success('Entries refreshed');
  };

  useEffect(() => {
    fetchRecentEntries();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="recent-container">
        <PageHeader 
          title="Recent Entries" 
          showProfile={true}
          currentEmployee={currentEmployee}
          onLogout={onLogout}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
        />
        <div className="recent-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading completed entries...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalWeekTime = calculateTotalWeekTime();

  return (
    <div className="recent-container">
      <PageHeader 
        title="Recent Entries" 
        showProfile={true}
        currentEmployee={currentEmployee}
        onLogout={onLogout}
        showProfileDropdown={showProfileDropdown}
        setShowProfileDropdown={setShowProfileDropdown}
      />

      <div className="recent-content">
        {/* Week Summary */}
        <div className="week-summary">
          <div className="summary-card">
            <div className="summary-icon time-icon">
              <span className="material-icons">schedule</span>
            </div>
            <div className="summary-content">
              <div className="summary-label">This Week</div>
              <div className="summary-value">{formatDuration(totalWeekTime)}</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon entries-icon">
              <span className="material-icons">assignment_turned_in</span>
            </div>
            <div className="summary-content">
              <div className="summary-label">Completed Entries</div>
              <div className="summary-value">{recentEntries.length}</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon projects-icon">
              <span className="material-icons">folder</span>
            </div>
            <div className="summary-content">
              <div className="summary-label">Active Projects</div>
              <div className="summary-value">{Object.keys(groupedEntries).length}</div>
            </div>
          </div>
        </div>

        {/* Week Header */}
        <div className="week-header">
          <div className="week-title">
            <span className="material-icons">calendar_today</span>
            <span>Week of {currentWeek}</span>
          </div>
          <button className="refresh-button" onClick={refreshData} aria-label="Refresh entries">
            <span className="material-icons">refresh</span>
          </button>
        </div>

        {/* Projects List */}
        <div className="projects-list">
          {Object.keys(groupedEntries).length > 0 ? (
            Object.entries(groupedEntries).map(([dateKey, dateData]) => (
              <div key={dateKey} className="project-card">
                <div 
                  className="project-header"
                  onClick={() => toggleProjectExpansion(dateKey)}
                >
                  <div className="expand-indicator">
                    <span className={`material-icons ${expandedProjects.has(dateKey) ? 'expanded' : ''}`}>
                      keyboard_arrow_down
                    </span>
                  </div>
                  <div className="project-name">{dateKey}</div>
                  <div className="project-time">{formatDuration(dateData.totalTime)}</div>
                </div>
                
                {/* Project details (expanded) */}
                {expandedProjects.has(dateKey) && (
                  <div className="project-details">
                    {dateData.entries.map((entry, index) => (
                      <div key={entry.id} className="entry-item">
                        <div className="entry-info">
                          <div className="entry-icon">
                            <span className="material-icons">work</span>
                          </div>
                          <div className="entry-job">
                            {entry.job_name || 'Unnamed Job'}
                          </div>
                        </div>
                        <span className="info-icon" onClick={() => toggleEntryInfo(entry.id)}>
                          <span className="material-icons">info</span>
                        </span>
                        <div className="entry-duration">
                          {formatDuration(entry.total_seconds)}
                        </div>
                        
                                              {/* Entry Info Popup */}
                      {expandedEntryInfo === entry.id && (
                        <>
                          {/* Backdrop for outside click */}
                          <div 
                            className="popup-backdrop" 
                            onClick={() => toggleEntryInfo(entry.id)}
                          />
                          <div className="entry-info-popup">
                            <div className="popup-header">
                              <span>Information</span>
                              <button 
                                className="close-popup" 
                                onClick={() => toggleEntryInfo(entry.id)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="popup-content">
                              <div className="info-row">
                                <span className="info-label">Comment:</span>
                                <span className="info-value">
                                  {entry.comment || 'No comment provided'}
                                </span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">Account:</span>
                                <span className="info-value">
                                  {entry.account_name || 'No account specified'}
                                </span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">Start Location:</span>
                                <span className="info-value">
                                  {entry.start_location ? 'Location captured' : 'No location data'}

                                </span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">End Location:</span>
                                <span className="info-value">
                                  {entry.end_location ? 'Location captured' : 'No location data'}

                                </span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">End Time:</span>
                                <span className="info-value">
                                  {entry.end_time ? new Date(entry.end_time).toLocaleString() : 'Not recorded'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-entries">
              <div className="no-entries-icon">
                <span className="material-icons">history</span>
              </div>
              <h3>No entries this week</h3>
              <p>Completed time entries will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recent;