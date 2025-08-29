// Import centralized configuration
import config, { getSpireUrl } from './config/app-config.js';
import logger from './logger.js';

// Browser-compatible API fetcher
// Add timeout and retry configuration
const API_CONFIG = {
  timeout: 45000, // 45 seconds (increased for Spire API)
  retries: 2,
  retryDelay: 2000 // 2 seconds
};

// Helper function for making HTTP requests with retry logic
async function makeRequest(url, options, retryCount = 0) {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), API_CONFIG.timeout);
    });

    // Add CORS handling options
    const fetchOptions = {
      ...options,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };

    // Create the fetch promise
    const fetchPromise = fetch(url, fetchOptions);

    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    // Handle CORS errors specifically
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      logger.error('CORS Error', {
        message: error.message,
        url,
        retryCount,
      });
      throw new Error('CORS Error: API server does not allow cross-origin requests. Please contact your system administrator to enable CORS for this domain.');
    }
    
    if (retryCount < API_CONFIG.retries && (error.message === 'Request timeout' || error.message.includes('fetch'))) {
      logger.warn('Request failed, retrying...', {
        url,
        error: error.message,
        retryCount: retryCount + 1,
        maxRetries: API_CONFIG.retries,
      });
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay * (retryCount + 1)));
      return makeRequest(url, options, retryCount + 1);
    }
    
    logger.error('Request failed permanently', {
      url,
      error: error.message,
      retryCount,
      maxRetries: API_CONFIG.retries,
    });
    throw error;
  }
}

async function fetchJobCostingAccounts(jobCode) {
  try {
    if (!jobCode) {
      throw new Error("Job code is required to fetch accounts");
    }

    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    // Filter by the specific job code
    const filterObj = {
      "job.jobNo": { "$eq": jobCode }
    };
    
    const filterStr = encodeURIComponent(JSON.stringify(filterObj));
    const accountsUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/job_costing/accounts?filter=${filterStr}&limit=100`;


    logger.debug(`API URL: ${accountsUrl}`);

    const response = await makeRequest(accountsUrl, {
      headers: AUTH_HEADER,
    });

    const accountsData = await response.json();
    const accounts = accountsData.records || [];
    
    logger.info(`Fetched ${accounts.length} job costing accounts for job ${jobCode}`);
    return accounts;
  } catch (error) {
    logger.error("Error in fetchJobCostingAccounts", {
      error: error.message,
      stack: error.stack,
      jobCode,
    });
    throw error;
  }
}

async function fetchJobs(searchTerm = null) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    // Use empty filter (get all)
    let filterObj = {};
    
    // If search term is provided, add it to the filter
    if (searchTerm && searchTerm.trim().length >= 2) {
      // Use $or to search across multiple fields based on actual API response structure
      filterObj["$or"] = [
        { "code": { "$like": `%${searchTerm.trim()}%` } },
        { "name": { "$like": `%${searchTerm.trim()}%` } }
      ];
    }
    
    const allJobs = [];
    const limit = 50; // Reduced from 100 to be more conservative
    let totalCount = null; // Will store the actual total from API
    const maxPages = 10; // Limit to maximum 10 pages to avoid overwhelming the API

    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    

    logger.info(`Will fetch maximum ${maxPages} pages with ${limit} jobs per page`);
    
    // Fetch jobs with pagination
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const jobsUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/job_costing/jobs?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      if (pageCount === 1) {
        logger.debug('Auth header', {
          authHeader: AUTH_HEADER.authorization.substring(0, 20) + '...',
        });
      }

      try {
        const response = await makeRequest(jobsUrl, {
          headers: AUTH_HEADER,
        });

        if (pageCount === 1) {
          logger.debug('Response status', {
            status: response.status,
            page: pageCount,
          });
        }

        const jobsData = await response.json();
        const jobs = jobsData.records || [];
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = jobsData.count || 0;
          logger.info(`Total jobs available: ${totalCount}`);
          logger.info(`First page records: ${jobs.length}`);
        }

        if (jobs.length === 0) {
          hasMore = false;
          logger.info(`Stopped: Page ${pageCount} returned 0 records`);
        } else {
          allJobs.push(...jobs);
          offset += limit;
          
          logger.info(`Page ${pageCount}: Got ${jobs.length} jobs, Total so far: ${allJobs.length}`);
          
          // Stop if we've fetched all available records
          if (allJobs.length >= totalCount) {
            hasMore = false;
            logger.info(`Stopped: Fetched ${allJobs.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (jobs.length < limit) {
            hasMore = false;
            logger.info(`Stopped: Last page had ${jobs.length} < ${limit} records`);
          }
        }
      } catch (error) {
        logger.error(`Error fetching page ${pageCount}`, {
          page: pageCount,
          error: error.message,
          url: jobsUrl,
        });
        
        // If it's a CORS error, stop trying more pages
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          logger.error('CORS error detected, stopping pagination');
          hasMore = false;
          break;
        }
        
        // Continue with next page if one fails (but not for CORS errors)
        offset += limit;
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allJobs.length > totalCount) {
      logger.warn(`Trimming from ${allJobs.length} to ${totalCount} jobs`);
      allJobs.splice(totalCount);
    }
    
    if (pageCount >= maxPages) {
      logger.warn(`Reached maximum page limit (${maxPages}). Some jobs may not be loaded.`);
    }
    
    logger.info(`Fetched ${allJobs.length} jobs from ${pageCount} pages`);
    return allJobs;
  } catch (error) {
    logger.error("Error in fetchJobs", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function fetchEmployees(searchTerm = null) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    // Use active employees filter by default
    let filterObj = { status: "A" }; // Filter for active employees only
    
    if (searchTerm && searchTerm.trim().length >= 2) {
      filterObj["$or"] = [
        { "employeeNo": { "$like": `%${searchTerm.trim()}%` } },
        { "name": { "$like": `%${searchTerm.trim()}%` } }
      ];
    }
    
    const allEmployees = [];
    const limit = 100; // API limit per page
    let totalCount = null; // Will store the actual total from API

    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    

    
    // Fetch employees with pagination
    while (hasMore) {
      pageCount++;
      
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const employeesUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/payroll/employees?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      if (pageCount === 1) {
        logger.debug('Auth header', {
          authHeader: AUTH_HEADER.authorization.substring(0, 20) + '...',
        });
      }

      try {
        const response = await makeRequest(employeesUrl, {
          headers: AUTH_HEADER,
        });

        if (pageCount === 1) {
          logger.debug('Response status', {
            status: response.status,
            page: pageCount,
          });
        }

        const employeesData = await response.json();
        const employees = employeesData.records || [];
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = employeesData.count || 0;
          logger.info(`Total employees available: ${totalCount}`);
          logger.info(`First page records: ${employees.length}`);
        }

        if (employees.length === 0) {
          hasMore = false;
          logger.info(`Stopped: Page ${pageCount} returned 0 records`);
        } else {
          allEmployees.push(...employees);
          offset += limit;
          
          logger.info(`Page ${pageCount}: Got ${employees.length} employees, Total so far: ${allEmployees.length}`);
          
          // Stop if we've fetched all available records
          if (allEmployees.length >= totalCount) {
            hasMore = false;
            logger.info(`Stopped: Fetched ${allEmployees.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (employees.length < limit) {
            hasMore = false;
            logger.info(`Stopped: Last page had ${employees.length} < ${limit} records`);
          }
        }
      } catch (error) {
        logger.error(`Error fetching page ${pageCount}`, {
          page: pageCount,
          error: error.message,
          url: employeesUrl,
        });
        logger.error('Stopping employee fetch due to error');
        hasMore = false;
        break; // Stop on ANY error
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allEmployees.length > totalCount) {
      logger.warn(`Trimming from ${allEmployees.length} to ${totalCount} employees`);
      allEmployees.splice(totalCount);
    }
    
    logger.info(`Fetched ${allEmployees.length} employees from ${pageCount} pages`);
    return allEmployees;
  } catch (error) {
    logger.error("Error in fetchEmployees", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Export functions for use in other modules (ES6)
export {
  fetchJobs,
  fetchEmployees,
  fetchJobCostingAccounts,
  makeRequest
};
