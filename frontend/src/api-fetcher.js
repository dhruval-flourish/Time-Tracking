// Import centralized configuration
import config, { getSpireUrl } from './config/app-config.js';

// Browser-compatible API fetcher
// Add timeout and retry configuration
const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000 // 1 second
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
      console.error('🚫 CORS Error:', error.message);
      console.log('💡 Try using a CORS proxy or contact your API administrator');
      throw new Error('CORS Error: API server does not allow cross-origin requests. Please contact your system administrator to enable CORS for this domain.');
    }
    
    if (retryCount < API_CONFIG.retries && (error.message === 'Request timeout' || error.message.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay * (retryCount + 1)));
      return makeRequest(url, options, retryCount + 1);
    }
    throw error;
  }
}

async function fetchOrders(searchTerm = null) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    const VERIFY_SSL = true;
    
    // Use config filter if it exists, otherwise empty filter (get all)
    let filterObj = config.filter || {};
    
    // If search term is provided, add it to the filter
    if (searchTerm && searchTerm.trim().length >= 2) {
      // Use $or to search across multiple fields
      filterObj["$or"] = [
        { "orderNo": { "$like": `%${searchTerm.trim()}%` } },
        { "customer.name": { "$like": `%${searchTerm.trim()}%` } },
        { "customerPO": { "$like": `%${searchTerm.trim()}%` } }
      ];
    }
    
    const allOrders = [];
    const limit = 100; // API limit per page
    let totalCount = null; // Will store the actual total from API

    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    
    // Fetch orders with pagination using the proper filter
    while (hasMore) {
      pageCount++;
      
      // Encode the filter according to Spire API specifications
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const ordersUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/sales/orders/?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      try {
        const ordersResponse = await makeRequest(ordersUrl, {
          headers: AUTH_HEADER,
        });

        const ordersJson = await ordersResponse.json();
        const orders = (ordersJson.records || []).map(order => ({
          orderNo: order.orderNo,
          customer: order.customer,
          customerPO: order.customerPO
        }));
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = ordersJson.count || 0;
          console.log(`📊 Total orders available: ${totalCount}`);
        }

        if (orders.length === 0) {
          hasMore = false;
        } else {
          allOrders.push(...orders);
          offset += limit;
          
          // Stop if we've fetched all available records
          if (allOrders.length >= totalCount) {
            hasMore = false;
            console.log(`🛑 Stopped: Fetched ${allOrders.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (orders.length < limit) {
            hasMore = false;
            console.log(`🛑 Stopped: Last page had ${orders.length} < ${limit} records`);
          }
        }
      } catch (error) {
        console.error(`Error fetching page ${pageCount}:`, error.message);
        // Continue with next page if one fails
        offset += limit;
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allOrders.length > totalCount) {
      console.log(`⚠️  Trimming from ${allOrders.length} to ${totalCount} orders`);
      allOrders.splice(totalCount);
    }
    
    console.log(`✅ Fetched ${allOrders.length} orders from ${pageCount} pages`);

    return allOrders;
  } catch (error) {
    console.error("Error in fetchOrders:", error.message);
    throw error;
  }
}

async function fetchOrderDetails(orderId) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    const orderUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/sales/orders/${orderId}`;

    const response = await makeRequest(orderUrl, {
      headers: AUTH_HEADER,
    });

    const orderData = await response.json();
    return orderData;
  } catch (error) {
    console.error("Error in fetchOrderDetails:", error.message);
    throw error;
  }
}

async function fetchCustomers(searchTerm = null) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    let filterObj = {};
    
    if (searchTerm && searchTerm.trim().length >= 2) {
      filterObj["$or"] = [
        { "name": { "$like": `%${searchTerm.trim()}%` } },
        { "customerNo": { "$like": `%${searchTerm.trim()}%` } }
      ];
    }
    
    const allCustomers = [];
    const limit = 100; // API limit per page
    let totalCount = null; // Will store the actual total from API

    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    
    // Fetch customers with pagination
    while (hasMore) {
      pageCount++;
      
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const customersUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/customers/?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      try {
        const response = await makeRequest(customersUrl, {
          headers: AUTH_HEADER,
        });

        const customersData = await response.json();
        const customers = (customersData.records || []).map(customer => ({
          customerNo: customer.customerNo,
          name: customer.name
        }));
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = customersData.count || 0;
          console.log(`📊 Total customers available: ${totalCount}`);
        }

        if (customers.length === 0) {
          hasMore = false;
        } else {
          allCustomers.push(...customers);
          offset += limit;
          
          // Stop if we've fetched all available records
          if (allCustomers.length >= totalCount) {
            hasMore = false;
            console.log(`🛑 Stopped: Fetched ${allCustomers.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (customers.length < limit) {
            hasMore = false;
            console.log(`🛑 Stopped: Last page had ${customers.length} < ${limit} records`);
          }
        }
      } catch (error) {
        console.error(`Error fetching page ${pageCount}:`, error.message);
        // Continue with next page if one fails
        offset += limit;
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allCustomers.length > totalCount) {
      console.log(`⚠️  Trimming from ${allCustomers.length} to ${totalCount} customers`);
      allCustomers.splice(totalCount);
    }
    
    console.log(`✅ Fetched ${allCustomers.length} customers from ${pageCount} pages`);
    return allCustomers;
  } catch (error) {
    console.error("Error in fetchCustomers:", error.message);
    throw error;
  }
}

async function fetchWorkOrders(searchTerm = null) {
  try {
    // Use centralized configuration
    const BASE_URL = getSpireUrl();
    const COMPANY = config.spire.company;
    const AUTH_HEADER = {
      authorization: config.spire.auth,
    };
    
    // Use empty filter (get all)
    let filterObj = {};
    
    if (searchTerm && searchTerm.trim().length >= 2) {
      filterObj["$or"] = [
        { "orderNo": { "$like": `%${searchTerm.trim()}%` } },
        { "customer.name": { "$like": `%${searchTerm.trim()}%` } },
        { "customerPO": { "$like": `%${searchTerm.trim()}%` } }
      ];
    }
    
    const allWorkOrders = [];
    const limit = 100; // API limit per page
    let totalCount = null; // Will store the actual total from API

    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    
    // Fetch work orders with pagination
    while (hasMore) {
      pageCount++;
      
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const workOrdersUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/sales/orders/?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      if (pageCount === 1) {
    
        console.log('🔑 Auth header:', AUTH_HEADER.authorization.substring(0, 20) + '...');
      }

      try {
        const response = await makeRequest(workOrdersUrl, {
          headers: AUTH_HEADER,
        });

        if (pageCount === 1) {
          console.log('📡 Response status:', response.status);
        }

        const workOrdersData = await response.json();
        const workOrders = (workOrdersData.records || []).map(wo => ({
          orderNo: wo.orderNo,
          customer: wo.customer,
          customerPO: wo.customerPO
        }));
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = workOrdersData.count || 0;
          console.log(`📊 Total work orders available: ${totalCount}`);
        }

        if (workOrders.length === 0) {
          hasMore = false;
        } else {
          allWorkOrders.push(...workOrders);
          offset += limit;
          
          // Stop if we've fetched all available records
          if (allWorkOrders.length >= totalCount) {
            hasMore = false;
            console.log(`🛑 Stopped: Fetched ${allWorkOrders.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (workOrders.length < limit) {
            hasMore = false;
            console.log(`🛑 Stopped: Last page had ${workOrders.length} < ${limit} records`);
          }
        }
      } catch (error) {
        console.error(`Error fetching page ${pageCount}:`, error.message);
        // Continue with next page if one fails
        offset += limit;
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allWorkOrders.length > totalCount) {
      console.log(`⚠️  Trimming from ${allWorkOrders.length} to ${totalCount} work orders`);
      allWorkOrders.splice(totalCount);
    }
    
    console.log(`✅ Fetched ${allWorkOrders.length} work orders from ${pageCount} pages`);
    return allWorkOrders;
  } catch (error) {
    console.error("Error in fetchWorkOrders:", error.message);
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


    console.log(`🔗 API URL: ${accountsUrl}`);

    const response = await makeRequest(accountsUrl, {
      headers: AUTH_HEADER,
    });

    const accountsData = await response.json();
    const accounts = accountsData.records || [];
    
    console.log(`✅ Fetched ${accounts.length} job costing accounts for job ${jobCode}`);
    return accounts;
  } catch (error) {
    console.error("Error in fetchJobCostingAccounts:", error.message);
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
    

    console.log(`📊 Will fetch maximum ${maxPages} pages with ${limit} jobs per page`);
    
    // Fetch jobs with pagination
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      
      const filterStr = encodeURIComponent(JSON.stringify(filterObj));
      const jobsUrl = `${BASE_URL}/api/v2/companies/${COMPANY}/job_costing/jobs?filter=${filterStr}&limit=${limit}&offset=${offset}`;

      if (pageCount === 1) {
    
        console.log('🔑 Auth header:', AUTH_HEADER.authorization.substring(0, 20) + '...');
      }

      try {
        const response = await makeRequest(jobsUrl, {
          headers: AUTH_HEADER,
        });

        if (pageCount === 1) {
          console.log('📡 Response status:', response.status);
        }

        const jobsData = await response.json();
        const jobs = jobsData.records || [];
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = jobsData.count || 0;
          console.log(`📊 Total jobs available: ${totalCount}`);
          console.log(`📄 First page records: ${jobs.length}`);
        }

        if (jobs.length === 0) {
          hasMore = false;
          console.log(`🛑 Stopped: Page ${pageCount} returned 0 records`);
        } else {
          allJobs.push(...jobs);
          offset += limit;
          
          console.log(`📄 Page ${pageCount}: Got ${jobs.length} jobs, Total so far: ${allJobs.length}`);
          
          // Stop if we've fetched all available records
          if (allJobs.length >= totalCount) {
            hasMore = false;
            console.log(`🛑 Stopped: Fetched ${allJobs.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (jobs.length < limit) {
            hasMore = false;
            console.log(`🛑 Stopped: Last page had ${jobs.length} < ${limit} records`);
          }
        }
      } catch (error) {
        console.error(`Error fetching page ${pageCount}:`, error.message);
        
        // If it's a CORS error, stop trying more pages
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          console.log('🚫 CORS error detected, stopping pagination');
          hasMore = false;
          break;
        }
        
        // Continue with next page if one fails (but not for CORS errors)
        offset += limit;
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allJobs.length > totalCount) {
      console.log(`⚠️  Trimming from ${allJobs.length} to ${totalCount} jobs`);
      allJobs.splice(totalCount);
    }
    
    if (pageCount >= maxPages) {
      console.log(`⚠️  Reached maximum page limit (${maxPages}). Some jobs may not be loaded.`);
    }
    
    console.log(`✅ Fetched ${allJobs.length} jobs from ${pageCount} pages`);
    return allJobs;
  } catch (error) {
    console.error("❌ Error in fetchJobs:", error.message);
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
    
        console.log('🔑 Auth header:', AUTH_HEADER.authorization.substring(0, 20) + '...');
      }

      try {
        const response = await makeRequest(employeesUrl, {
          headers: AUTH_HEADER,
        });

        if (pageCount === 1) {
          console.log('📡 Response status:', response.status);
        }

        const employeesData = await response.json();
        const employees = employeesData.records || [];
        
        // Get total count from first page
        if (pageCount === 1) {
          totalCount = employeesData.count || 0;
          console.log(`📊 Total employees available: ${totalCount}`);
          console.log(`📄 First page records: ${employees.length}`);
        }

        if (employees.length === 0) {
          hasMore = false;
          console.log(`🛑 Stopped: Page ${pageCount} returned 0 records`);
        } else {
          allEmployees.push(...employees);
          offset += limit;
          
          console.log(`📄 Page ${pageCount}: Got ${employees.length} employees, Total so far: ${allEmployees.length}`);
          
          // Stop if we've fetched all available records
          if (allEmployees.length >= totalCount) {
            hasMore = false;
            console.log(`🛑 Stopped: Fetched ${allEmployees.length} >= ${totalCount} total`);
          }
          
          // Also stop if we got fewer records than the limit (last page)
          if (employees.length < limit) {
            hasMore = false;
            console.log(`🛑 Stopped: Last page had ${employees.length} < ${limit} records`);
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching page ${pageCount}:`, error.message);
        console.error(`🛑 Stopping employee fetch due to error.`);
        hasMore = false;
        break; // Stop on ANY error
      }
    }

    // Ensure we don't return more than the total count
    if (totalCount && allEmployees.length > totalCount) {
      console.log(`⚠️  Trimming from ${allEmployees.length} to ${totalCount} employees`);
      allEmployees.splice(totalCount);
    }
    
    console.log(`✅ Fetched ${allEmployees.length} employees from ${pageCount} pages`);
    return allEmployees;
  } catch (error) {
    console.error("❌ Error in fetchEmployees:", error.message);
    throw error;
  }
}

// Export functions for use in other modules (ES6)
export {
  fetchOrders,
  fetchOrderDetails,
  fetchCustomers,
  fetchWorkOrders,
  fetchJobs,
  fetchEmployees,
  fetchJobCostingAccounts,
  makeRequest
};
