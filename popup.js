import { supportedWebsites } from './websites.js'

// Move checkbox change handler outside DOMContentLoaded
const handleCheckboxChange = async (e) => {
  if (e.target.type === 'checkbox' && e.target.closest('.website-option')) {
    const newSettings = {}
    supportedWebsites.forEach(website => {
      const checkbox = document.getElementById(website.id)
      if (checkbox) {
        newSettings[website.id] = checkbox.checked
      }
    })
    await chrome.storage.sync.set({ websiteSettings: newSettings })
    const statusMessage = document.getElementById('statusMessage')
    if (statusMessage) {
      statusMessage.textContent = 'Settings saved'
      statusMessage.className = 'status-message success'
      statusMessage.style.display = 'block'
      setTimeout(() => {
        statusMessage.style.display = 'none'
      }, 2000)
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded')
  const locationInput = document.getElementById('location')
  const searchBtn = document.getElementById('searchBtn')
  const scrapeBtn = document.getElementById('scrapeBtn')
  const downloadBtn = document.getElementById('downloadBtn')
  const showInJobJourneyBtn = document.getElementById('showInJobJourneyBtn')
  const jobList = document.getElementById('jobList')
  const statusMessage = document.getElementById('statusMessage')
  const progressSection = document.getElementById('progressSection')
  const progressFill = document.getElementById('progressFill')
  const progressText = document.getElementById('progressText')
  const websiteOptions = document.getElementById('websiteOptions')
  console.log('websiteOptions element:', websiteOptions)
  console.log('supportedWebsites:', supportedWebsites)

  let scrapedJobs = []

  // Load last used location from storage
  chrome.storage.local.get(['lastLocation'], (result) => {
    if (result.lastLocation) {
      locationInput.value = result.lastLocation
    }
  })

  // Load saved settings
  const settings = await chrome.storage.sync.get('websiteSettings')
  const savedSettings = settings.websiteSettings || {}
  console.log('savedSettings:', savedSettings)

  // Create checkbox for each website
  supportedWebsites.forEach(website => {
    console.log('Creating checkbox for:', website.name)
    const isEnabled = savedSettings[website.id] !== undefined ?
      savedSettings[website.id] : website.enabled

    const div = document.createElement('div')
    div.className = 'website-option'

    div.innerHTML = `
      <label>
        <input type="checkbox" 
               id="${website.id}" 
               ${isEnabled ? 'checked' : ''}>
        ${website.name}
      </label>
    `
    websiteOptions.appendChild(div)
    console.log('Added checkbox for:', website.name)
  })

  // Add the change event listener to the websiteOptions container
  if (websiteOptions) {
    websiteOptions.addEventListener('change', handleCheckboxChange)
  }

  function showMessage (message, isError = false) {
    statusMessage.textContent = message
    statusMessage.className = `status-message ${isError ? 'error' : 'success'}`
    statusMessage.style.display = 'block'
    setTimeout(() => {
      statusMessage.style.display = 'none'
    }, 2000)
  }

  function updateProgress (percent, text) {
    progressFill.style.width = `${percent}%`
    progressText.textContent = text
  }

  function createJobCard (job) {
    const card = document.createElement('div')
    card.className = 'job-card'

    const title = document.createElement('h3')
    title.textContent = job.title

    const company = document.createElement('p')
    company.textContent = `Company: ${job.company}`

    const location = document.createElement('p')
    location.textContent = `Location: ${job.location}`

    const platform = document.createElement('p')
    platform.textContent = `Platform: ${job.platform}`

    // Add job type if available
    const jobType = document.createElement('p')
    jobType.className = 'job-type'
    jobType.textContent = job.jobType ? `Job Type: ${job.jobType}` : ''
    jobType.style.display = job.jobType ? 'block' : 'none'

    // Add salary if available
    const salary = document.createElement('p')
    salary.className = 'salary'
    salary.textContent = job.salary ? `Salary: ${job.salary}` : ''
    salary.style.display = job.salary ? 'block' : 'none'

    // Add description if available
    const description = document.createElement('p')
    description.className = 'job-description'
    description.textContent = job.description ? `Description: ${job.description}` : ''
    description.style.display = job.description ? 'block' : 'none'

    // Add posted date if available
    const postedDate = document.createElement('p')
    postedDate.className = 'posted-date'
    postedDate.textContent = job.postedDate ? `Posted: ${job.postedDate}` : ''
    postedDate.style.display = job.postedDate ? 'block' : 'none'

    const actions = document.createElement('div')
    actions.className = 'job-actions'

    const viewBtn = document.createElement('button')
    viewBtn.textContent = 'View'
    viewBtn.onclick = () => {
      chrome.tabs.create({ url: job.jobUrl })
    }

    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.className = 'save-btn'
    saveBtn.onclick = async () => {
      showMessage('Save feature will be available when connected to backend')
    }

    actions.appendChild(viewBtn)
    actions.appendChild(saveBtn)

    card.appendChild(title)
    card.appendChild(company)
    card.appendChild(location)
    card.appendChild(platform)
    card.appendChild(jobType)
    card.appendChild(salary)
    card.appendChild(description)
    card.appendChild(postedDate)
    card.appendChild(actions)

    return card
  }

  function downloadExcel (jobs) {
    const headers = ['Title', 'Company', 'Location', 'Platform', 'URL', 'Description', 'Salary', 'Job Type']
    const csvContent = [
      headers.join(','),
      ...jobs.map(job => [
        `"${job.title || ''}"`,
        `"${job.company || ''}"`,
        `"${job.location || ''}"`,
        `"${job.platform || ''}"`,
        `"${job.jobUrl || ''}"`,
        `"${(job.description || '').replace(/"/g, '""')}"`,
        `"${job.salary || ''}"`,
        `"${job.jobType || ''}"`,
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `jobs_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 等待页面加载完成
  function waitForPageLoad (tabId) {
    return new Promise((resolve) => {
      function listener (updatedTabId, info) {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          // 给页面额外的3秒加载时间
          setTimeout(resolve, 2000)
        }
      }
      chrome.tabs.onUpdated.addListener(listener)
    })
  }

  // 从单个标签页爬取数据
  async function scrapeFromTab (tab) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'scrapeJobs' }, (response) => {
        console.group('Tab Scraping Debug')
        console.log('Tab URL:', tab.url)
        console.log('Initial response:', response)

        if (chrome.runtime.lastError) {
          console.error(`Error with tab ${tab.id}:`, chrome.runtime.lastError)
          console.groupEnd()
          resolve([])
        } else if (response && response.success) {
          console.log('response:', response)
          const jobs = response.data || []

          // Remove duplicates
          console.log('Total jobs before deduplication:', jobs.length)
          const uniqueJobs = removeDuplicateJobs(jobs)
          console.log('Total jobs after deduplication:', uniqueJobs.length)
          console.groupEnd()
          resolve(uniqueJobs)
        } else {
          console.groupEnd()
          resolve([])
        }
      })
    })
  }

  // 根据标题和公司名称去重
  function removeDuplicateJobs (jobs) {
    const seen = new Set()
    return jobs.filter(job => {
      const key = `${job.title}-${job.company}-${job.location}`.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  // Add new function to handle Indeed pagination
  async function scrapeIndeedJobs (tab) {
    let allJobs = []

    // Get the current tab info to ensure we have the URL
    const currentTab = await chrome.tabs.get(tab.id)
    let currentUrl = currentTab.url
    console.log("Initial currentUrl:", currentUrl)

    while (currentUrl) {
      console.log("Loop start - currentUrl:", currentUrl)
      // Update tab URL if not first page
      if (currentUrl !== currentTab.url) {
        console.log("Updating tab URL to:", currentUrl)
        await chrome.tabs.update(tab.id, { url: currentUrl })
        await waitForPageLoad(tab.id)
      }

      // Scrape current page
      const response = await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeJobs' }, resolve)
      })
      console.log("Scraping response:", response)

      if (response && response.success) {
        console.log("Jobs found:", response.data.length)
        console.log("Next URL:", response.nextUrl)
        allJobs.push(...response.data)
        currentUrl = response.nextUrl
      } else {
        console.log("No success in response or error occurred")
        break
      }
    }

    // Add deduplication before returning
    console.log('Total Indeed jobs before deduplication:', allJobs.length)
    const uniqueJobs = removeDuplicateJobs(allJobs)
    console.log('Total Indeed jobs after deduplication:', uniqueJobs.length)
    return uniqueJobs
  }

  // Add show in JobJourney button handler
  showInJobJourneyBtn.addEventListener('click', async () => {
    console.log('Show in JobJourney button clicked')
    console.log('Jobs to send:', scrapedJobs)

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'openJobJourney',
        jobs: scrapedJobs
      })
      console.log('Response from openJobJourney:', response)

      if (response && response.success) {
        showMessage('Opening jobs in JobJourney...')
      } else {
        showMessage('Failed to open JobJourney', true)
        console.error('Failed to open JobJourney:', response)
      }
    } catch (error) {
      console.error('Error sending jobs to JobJourney:', error)
      showMessage('Error opening JobJourney', true)
    }
  })

  // Enable/disable showInJobJourneyBtn along with downloadBtn
  const updateButtonStates = (hasJobs) => {
    downloadBtn.disabled = !hasJobs
    showInJobJourneyBtn.disabled = !hasJobs
  }

  // Update search button click handler
  searchBtn.addEventListener('click', async () => {
    const location = locationInput.value.trim()

    if (!location) {
      showMessage('Please enter a location', true)
      return
    }

    console.log('=== Starting Job Search ===')
    console.log('Location:', location)

    // Save location to storage
    chrome.storage.local.set({ lastLocation: location })

    // Reset state
    scrapedJobs = []
    jobList.innerHTML = ''
    downloadBtn.disabled = true

    // Show progress section
    progressSection.style.display = 'block'
    updateProgress(0, 'Starting job search...')

    // Get current website settings
    const settings = await chrome.storage.sync.get('websiteSettings')
    const savedSettings = settings.websiteSettings || {}
    console.log('Current website settings:', savedSettings)

    // Filter sites based on checkbox selection
    const sites = [
      {
        id: 'linkedin',
        url: `https://www.linkedin.com/jobs/search?keywords=Full+Stack&location=${encodeURIComponent(location)}`,
        platform: 'LinkedIn',
        action: 'scrapeLinkedIn'
      },
      {
        id: 'seek',
        url: `https://www.seek.com.au/full-stack-jobs/in-${location.replace(/\s+/g, '-')}`,
        platform: 'SEEK',
        action: 'scrapeSEEK'
      },
      {
        id: 'indeed',
        url: `https://au.indeed.com/jobs?q=Full+Stack&l=${encodeURIComponent(location)}`,
        platform: 'Indeed',
        action: 'scrapeJobs'
      }
    ].filter(site => {
      const checkbox = document.getElementById(site.id)
      return checkbox && checkbox.checked
    })

    if (sites.length === 0) {
      showMessage('Please select at least one website', true)
      progressSection.style.display = 'none'
      return
    }

    console.log('Sites to scrape after filtering:', sites)
    let completedSites = 0
    const totalSites = sites.length

    // Get all windows to find the main browser window
    const windows = await new Promise(resolve => {
      chrome.windows.getAll({ windowTypes: ['normal'] }, resolve)
    })
    console.log('Found browser windows:', windows.length)

    // Find the main browser window (usually the first normal window)
    const mainWindow = windows.find(w => w.type === 'normal')
    if (!mainWindow) {
      console.error('No main browser window found')
      showMessage('Could not find main browser window', true)
      return
    }
    console.log('Selected main window:', mainWindow.id)

    // Get the current extension window
    const currentWindow = await new Promise(resolve => {
      chrome.windows.getCurrent(resolve)
    })

    for (const site of sites) {
      console.log(`\n=== Processing ${site.platform} ===`)

      const tab = await chrome.tabs.create({
        url: site.url,
        windowId: mainWindow.id,
        active: false
      })

      await waitForPageLoad(tab.id)

      // Handle Indeed differently
      let jobs = []
      if (site.platform === 'Indeed') {
        console.log("herehere")
        jobs = await scrapeIndeedJobs(tab)
      } else {
        jobs = await scrapeFromTab(tab)
      }

      scrapedJobs.push(...jobs)
      completedSites++
      showMessage(`Scraped ${jobs.length} jobs from ${site.platform}`)

      // Update UI
      jobList.innerHTML = ''
      scrapedJobs.forEach(job => {
        jobList.appendChild(createJobCard(job))
      })
      console.log(`Completed ${site.platform} processing\n`)
    }

    console.log('=== Scraping Complete ===')
    console.log('Total jobs scraped:', scrapedJobs.length)
    updateProgress(100, `Scraped ${scrapedJobs.length} jobs from ${totalSites} sites`)
    showMessage(`Successfully scraped ${scrapedJobs.length} jobs!`)
    updateButtonStates(scrapedJobs.length > 0)

    // Focus back on the extension window at the end
    chrome.windows.update(currentWindow.id, { focused: true })
  })

  downloadBtn.addEventListener('click', () => {
    if (scrapedJobs.length === 0) {
      showMessage('No jobs to download', true)
      return
    }
    downloadExcel(scrapedJobs)
    showMessage('Jobs downloaded successfully!')
  })
})

// Update message listener in content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request)

  if (request.action === 'getNextPageUrl') {
    const platform = Object.values(scrapers).find(s => s.isMatch(window.location.href))
    if (platform && platform.getNextPageUrl) {
      const nextUrl = platform.getNextPageUrl()
      sendResponse({ nextUrl })
    } else {
      sendResponse({ nextUrl: null })
    }
    return true
  }

  // ... existing message handling code ...
}) 
