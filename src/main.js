import './style.css'
import L from 'leaflet'

// Global variables
let map
let currentSlideIndex = 0
let currentImages = []
let markers = []
let currentTripData = null
let imageCache = new Map() // Cache for preloaded images
let preloadingPromises = new Map() // Track ongoing preloading
let preloadQueue = [] // Queue for background preloading
let currentSelectedDay = 0 // Track currently selected day for keyboard navigation
let sidebarFocused = false // Track if sidebar has focus for keyboard navigation

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeMap()
  loadAndRenderTrip()
  setupModalHandlers()
  setupKeyboardNavigation()
  
  // Add mobile enhancements
  addTouchGestures()
  enhanceMapForMobile()
  
  // Handle window resize for mobile/desktop switching
  window.addEventListener('resize', () => {
    enhanceMapForMobile()
    handleZoomControlsOnResize()
  })
})

// Load and render trip data
async function loadAndRenderTrip() {
  try {
    // Try to load custom trip from localStorage first
    const customTrip = localStorage.getItem('customTrip')
    let tripMarkdown
    
    if (customTrip) {
      tripMarkdown = customTrip
    } else {
      // Load default trip from public/trip.md
      // Handle both development and production paths
      let response = await fetch('./trip.md')
      
      // If that fails, try alternative paths
      if (!response.ok) {
        response = await fetch('/FranceRoadTrip/trip.md')
      }
      
      if (!response.ok) {
        response = await fetch('/trip.md')
      }
      
      if (!response.ok) {
        throw new Error('Failed to load default trip')
      }
      
      tripMarkdown = await response.text()
    }
    
    // Parse the markdown and render
    const parsedData = parseTripMarkdown(tripMarkdown)
    console.log('Parsed trip data:', parsedData)
    renderPage(parsedData)
    
  } catch (error) {
    console.error('Error loading trip:', error)
    showError('Failed to load trip data. Please try again.')
  }
}

// Parse trip markdown into structured data
function parseTripMarkdown(markdown) {
  const lines = markdown.split('\n')
  const tripData = {
    title: '',
    subtitle: '',
    days: []
  }
  
  let currentDay = null
  let currentSection = null
  let inFrontmatter = false
  let locationInfo = {}
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Handle YAML frontmatter
    if (line === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }
    
    // Parse frontmatter content
    if (inFrontmatter) {
      if (line.startsWith('title:')) {
        tripData.title = line.substring(6).trim().replace(/['"]/g, '')
      }
      else if (line.startsWith('subtitle:')) {
        tripData.subtitle = line.substring(9).trim().replace(/['"]/g, '')
      }
      // We could also handle startDate and endDate if needed
      continue
    }
    
    // Handle legacy format title
    if (line.startsWith('# ')) {
      tripData.title = line.substring(2).trim()
    }
    
    // Parse subtitle info (legacy format)
    else if (line.startsWith('**Duration:**')) {
      const duration = line.substring(13).trim()
      tripData.subtitle = duration
    }
    else if (line.startsWith('**Dates:**')) {
      const dates = line.substring(10).trim()
      if (tripData.subtitle) {
        tripData.subtitle += ' • ' + dates
      } else {
        tripData.subtitle = dates
      }
    }
    else if (line.startsWith('**Type:**')) {
      const type = line.substring(9).trim()
      if (tripData.subtitle) {
        tripData.subtitle += ' • ' + type
      } else {
        tripData.subtitle = type
      }
    }
    
    // Parse day headers - Support both old and new formats
    else if (line.startsWith('## Day ')) {
      // If we have a current day, add it to our days array
      if (currentDay) {
        // Only save valid days with coordinates
        if (currentDay.coordinates.length === 2) {
          tripData.days.push(currentDay)
        }
      }
      
      // Reset location info for the new day
      locationInfo = {}
      
      // Parse day number
      const dayNumberMatch = line.match(/## Day (\d+)/)
      const dayNumber = dayNumberMatch ? parseInt(dayNumberMatch[1]) : tripData.days.length + 1
      
      // Extract the title part after the day number
      let dayTitle = line.split(':').slice(1).join(':').trim()
      let city = '', country = ''
      
      // Try to parse city and country from title
      if (dayTitle.includes(',')) {
        const parts = dayTitle.split(',')
        city = parts[0].trim()
        country = parts[1].trim()
      } else {
        // Just use dayTitle as city
        city = dayTitle
      }
      
      currentDay = {
        id: dayNumber,
        day: `Day ${dayNumber}`,
        city: city,
        country: country,
        date: '',
        coordinates: [],
        camping: '',
        distance: '',
        images: [],
        description: '',
        activities: []
      }
      currentSection = 'day'
    }
    
    // Parse location info for new format
    else if (line.startsWith('- **Location**:')) {
      const locationParts = line.substring(14).trim().split(',')
      if (locationParts.length >= 2) {
        if (currentDay) {
          currentDay.city = locationParts[0].trim()
          currentDay.country = locationParts[1].trim()
        } else {
          locationInfo.city = locationParts[0].trim()
          locationInfo.country = locationParts[1].trim()
        }
      } else if (locationParts.length === 1) {
        if (currentDay) {
          currentDay.city = locationParts[0].trim()
        } else {
          locationInfo.city = locationParts[0].trim()
        }
      }
    }
    else if (line.startsWith('- **Coords**:')) {
      const coordsStr = line.substring(12).trim()
      const coords = coordsStr.split(',').map(c => parseFloat(c.trim()))
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        if (currentDay) {
          currentDay.coordinates = coords
        } else {
          locationInfo.coordinates = coords
        }
      }
    }
    else if (line.startsWith('- **Camping**:')) {
      const camping = line.substring(14).trim()
      if (currentDay) {
        currentDay.camping = camping
      } else {
        locationInfo.camping = camping
      }
    }
    else if (line.startsWith('- **Notes**:')) {
      const notes = line.substring(11).trim()
      if (currentDay) {
        currentDay.description = notes
      } else {
        locationInfo.description = notes
      }
    }
    
    // Parse day details with various formats (legacy format)
    else if (currentDay && (line.startsWith('**Date:**') || line.startsWith('- **Date:**'))) {
      currentDay.date = line.includes('- **Date:**') 
        ? line.substring(11).trim() 
        : line.substring(9).trim()
    }
    else if (currentDay && (line.startsWith('**Coordinates:**') || line.startsWith('- **Coords:**'))) {
      const coordsStr = line.includes('- **Coords:**') 
        ? line.substring(13).trim() 
        : line.substring(16).trim()
      
      const coords = coordsStr.split(',').map(c => parseFloat(c.trim()))
      
      // Make sure we have valid coordinates
      if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        currentDay.coordinates = coords
      }
    }
    else if (currentDay && (line.startsWith('**Camping:**') || line.startsWith('- **Camping:**'))) {
      currentDay.camping = line.includes('- **Camping:**') 
        ? line.substring(14).trim() 
        : line.substring(12).trim()
    }
    else if (currentDay && (line.startsWith('**Distance:**') || line.startsWith('- **Distance:**'))) {
      currentDay.distance = line.includes('- **Distance:**') 
        ? line.substring(15).trim() 
        : line.substring(13).trim()
    }
    else if (currentDay && (line.startsWith('**Images:**') || line.startsWith('- **Images:**'))) {
      const imagesStr = line.includes('- **Images:**') 
        ? line.substring(13).trim() 
        : line.substring(11).trim()
      
      // Parse comma-separated image locations
      if (imagesStr) {
        currentDay.images = imagesStr.split(',').map(img => img.trim()).filter(img => img.length > 0)
      }
    }
    else if (currentDay && line.startsWith('**Activities:**')) {
      currentSection = 'activities'
    }
    else if (currentDay && (line.startsWith('- **Notes:**') || line.startsWith('**Notes:**'))) {
      const notes = line.includes('- **Notes:**') 
        ? line.substring(12).trim() 
        : line.substring(10).trim()
      
      if (notes) {
        currentDay.description = notes
      }
    }
    
    // Parse activities
    else if (currentSection === 'activities' && line.startsWith('- ')) {
      if (currentDay) {
        if (!currentDay.activities) currentDay.activities = [];
        currentDay.activities.push(line.substring(2).trim())
      }
    }
    
    // Parse description (lines between day header and first bold field)
    else if (currentDay && currentSection === 'day' && line && !line.startsWith('**') && !line.startsWith('-')) {
      if (currentDay.description) {
        currentDay.description += ' ' + line
      } else {
        currentDay.description = line
      }
    }
  }
  
  // Add the last day if it exists and has coordinates
  if (currentDay && currentDay.coordinates.length === 2) {
    tripData.days.push(currentDay)
  }
  
  // Validate the parsed data
  if (!tripData.title || tripData.days.length === 0) {
    console.error("Parsing failed: Missing title or no days found", tripData);
    throw new Error('Invalid trip format');
  }
  
  // Ensure all days have coordinates
  for (const day of tripData.days) {
    if (!day.coordinates || day.coordinates.length !== 2 || 
        isNaN(day.coordinates[0]) || isNaN(day.coordinates[1])) {
      console.error(`Missing or invalid coordinates for day ${day.day}`);
      throw new Error(`Invalid coordinates for ${day.day}`);
    }
  }
  
  console.log('Parsed trip data:', tripData);
  return tripData
}

// Render the page with parsed trip data
function renderPage(tripData) {
  currentTripData = tripData
  
  // Update header
  document.querySelector('.header h1').textContent = `🚗 ${tripData.title}`
  document.getElementById('trip-subtitle').textContent = tripData.subtitle
  
  // Clear existing content
  document.getElementById('itinerary').innerHTML = ''
  markers.forEach(marker => map.removeLayer(marker))
  markers = []
  
  // Clear existing route lines
  map.eachLayer(function(layer) {
    if (layer instanceof L.Polyline) {
      map.removeLayer(layer)
    }
  })
  
  // Render itinerary
  renderItinerary(tripData.days)
  
  // Add map markers and draw route
  addMapMarkers(tripData.days)
  drawRoute(tripData.days)
  
  // Start background image preloading for all days
  startBackgroundImagePreloading(tripData.days)
}

// Setup modal event handlers
function setupModalHandlers() {
  const modal = document.getElementById('trip-modal')
  const loadTripBtn = document.getElementById('load-trip-btn')
  const mobileLoadTripBtn = document.getElementById('mobile-load-trip-btn')
  const closeBtn = document.querySelector('.close-modal')
  const copyPromptBtn = document.getElementById('copy-prompt-btn')
  const loadTripSubmit = document.getElementById('load-trip-submit')
  const tripTextarea = document.getElementById('trip-markdown')
  const errorDiv = document.getElementById('trip-error')
  
  // Open modal (desktop)
  loadTripBtn.addEventListener('click', () => {
    modal.style.display = 'block'
    tripTextarea.focus()
  })
  
  // Open modal (mobile)
  mobileLoadTripBtn.addEventListener('click', () => {
    modal.style.display = 'block'
    tripTextarea.focus()
  })
  
  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none'
    clearError()
  })
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none'
      clearError()
    }
  })
  
  // Copy prompt template
  copyPromptBtn.addEventListener('click', async () => {
    try {
      // Try multiple paths for the prompt template
      let response = await fetch('./prompt-template.md')
      
      // If that fails, try alternative paths
      if (!response.ok) {
        response = await fetch('/FranceRoadTrip/prompt-template.md')
      }
      
      if (!response.ok) {
        response = await fetch('/prompt-template.md')
      }
      
      if (!response.ok) {
        throw new Error('Failed to load prompt template')
      }
      
      const promptText = await response.text()
      
      // Replace placeholder date with actual current date
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
      
      const updatedPrompt = promptText.replace(
        /July 17, 2025/g, 
        formattedDate
      )
      
      // Copy to clipboard with Safari fallback
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(updatedPrompt)
        } else {
          // Fallback for Safari and older browsers
          const textArea = document.createElement('textarea')
          textArea.value = updatedPrompt
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          textArea.style.top = '-999999px'
          textArea.style.opacity = '0'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          
          const successful = document.execCommand('copy')
          document.body.removeChild(textArea)
          
          if (!successful) {
            throw new Error('execCommand copy failed')
          }
        }
        
        // Show feedback
        const originalText = copyPromptBtn.textContent
        copyPromptBtn.textContent = 'Copied!'
        copyPromptBtn.classList.add('copied')
        setTimeout(() => {
          copyPromptBtn.textContent = originalText
          copyPromptBtn.classList.remove('copied')
        }, 2000)
        
      } catch (clipboardError) {
        console.error('Clipboard operation failed:', clipboardError)
        
        // Automatically open manual copy modal when clipboard fails
        openManualCopyModal(updatedPrompt)
      }
    } catch (error) {
      console.error('Error loading prompt template:', error)
      
      // Show error message and offer manual copy option
      showError('Failed to load prompt template. Please copy the text manually.')
      
      // Try to provide a basic prompt template as fallback
      const basicPrompt = `# Road Trip Generation Prompt

You are an expert road trip planner. Generate a road trip itinerary in Markdown format.

## Instructions
- Use destination-based day titles: "Day 1: Prague, Czech Republic" (NOT "Day 1: Berlin to Prague")
- Include GPS coordinates for each day
- Add specific landmarks in the Images field for photo sourcing
- The current date is ${new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long', 
  day: 'numeric'
})}

## Format
\`\`\`
# Trip Title

**Duration:** X days
**Dates:** Start - End
**Type:** Trip Type

## Day 1: City, Country
**Date:** Full Date
**Coordinates:** lat, lng
**Camping:** Campsite Name
**Distance:** Distance
**Images:** Landmark 1, Landmark 2, Building Name

Description of activities.

**Activities:**
- Activity 1
- Activity 2
\`\`\`

Now generate a trip based on the user's request:`

      // Open manual copy modal with basic prompt
      openManualCopyModal(basicPrompt)
    }
  })
  
  // Load custom trip
  loadTripSubmit.addEventListener('click', () => {
    const markdown = tripTextarea.value.trim()
    if (!markdown) {
      showError('Please paste your trip Markdown')
      return
    }
    
    try {
      const parsedData = parseTripMarkdown(markdown)
      
      // Validate parsed data
      if (!parsedData.title || parsedData.days.length === 0) {
        throw new Error('Invalid trip format')
      }
      
      // Save to localStorage
      localStorage.setItem('customTrip', markdown)
      
      // Render the new trip
      renderPage(parsedData)
      
      // Close modal
      modal.style.display = 'none'
      tripTextarea.value = ''
      clearError()
      
    } catch (error) {
      console.error('Error parsing trip:', error)
      showError('Invalid trip format. Please check your Markdown and try again.')
    }
  })
  
  // Add button to reset to default trip
  const resetBtn = document.createElement('button')
  resetBtn.textContent = 'Reset to Default'
  resetBtn.className = 'secondary-btn'
  resetBtn.style.marginRight = '0.5rem'
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('customTrip')
    loadAndRenderTrip()
    modal.style.display = 'none'
    tripTextarea.value = ''
    clearError()
  })
  
  document.querySelector('.modal-actions').insertBefore(resetBtn, copyPromptBtn)
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('trip-error')
  errorDiv.textContent = message
  errorDiv.classList.add('show')
}

// Clear error message
function clearError() {
  const errorDiv = document.getElementById('trip-error')
  errorDiv.classList.remove('show')
}

// Initialize Leaflet map
function initializeMap() {
  // Disable default zoom controls on mobile
  const isMobile = window.innerWidth <= 768
  
  map = L.map('map', {
    zoomControl: !isMobile // Disable default zoom controls on mobile
  }).setView([50.5, 3.0], 6)
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)
  
  // Add custom zoom controls for mobile
  if (isMobile) {
    addMobileZoomControls()
  }
}

// Add custom zoom controls for mobile
function addMobileZoomControls() {
  const mapContainer = document.getElementById('map')
  
  // Create zoom controls container
  const zoomControls = document.createElement('div')
  zoomControls.className = 'mobile-zoom-controls'
  
  // Zoom in button
  const zoomInBtn = document.createElement('button')
  zoomInBtn.className = 'mobile-zoom-btn'
  zoomInBtn.innerHTML = '+'
  zoomInBtn.addEventListener('click', () => {
    map.zoomIn()
  })
  
  // Zoom out button
  const zoomOutBtn = document.createElement('button')
  zoomOutBtn.className = 'mobile-zoom-btn'
  zoomOutBtn.innerHTML = '−'
  zoomOutBtn.addEventListener('click', () => {
    map.zoomOut()
  })
  
  zoomControls.appendChild(zoomInBtn)
  zoomControls.appendChild(zoomOutBtn)
  mapContainer.appendChild(zoomControls)
}

// Render itinerary in sidebar
function renderItinerary(tripDays) {
  const itineraryContainer = document.getElementById('itinerary')
  
  tripDays.forEach((day, index) => {
    const dayCard = document.createElement('div')
    dayCard.className = 'day-card'
    dayCard.setAttribute('data-day', index)
    
    dayCard.innerHTML = `
      <div class="day-header">
        <h3>${day.day} - ${day.city}</h3>
        <div class="date">${day.date}</div>
      </div>
      <div class="day-details">
        <h4>🏕️ ${day.camping}</h4>
        <p>${day.description}</p>
        <div class="distance">${day.distance}</div>
        <button class="view-location-btn" onclick="viewLocation(${index})">📍 View Location</button>
      </div>
    `
    
    dayCard.addEventListener('click', (e) => {
      // Don't trigger day selection if clicking on the view location button
      if (e.target.classList.contains('view-location-btn')) {
        return
      }
      
      currentSelectedDay = index // Update keyboard navigation state
      selectDay(index)
      // Update keyboard focus visual indicator
      if (window.innerWidth > 768) {
        updateKeyboardFocus()
      }
    })
    
    itineraryContainer.appendChild(dayCard)
  })
  
  // Initialize keyboard navigation state
  currentSelectedDay = 0
  if (window.innerWidth > 768) {
    updateKeyboardFocus()
  }
}

// Select a specific day
function selectDay(index, shouldZoomMap = false) {
  if (!currentTripData || !currentTripData.days[index]) return
  
  // Remove active class from all cards
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.remove('active')
  })
  
  // Add active class to selected card
  const selectedCard = document.querySelector(`[data-day="${index}"]`)
  selectedCard.classList.add('active')
  
  // Scroll to the selected day card with some offset from the top
  const sidebar = document.querySelector('.sidebar')
  const sidebarRect = sidebar.getBoundingClientRect()
  const cardRect = selectedCard.getBoundingClientRect()
  const offset = 100 // Pixels from top of sidebar
  
  // Calculate the scroll position
  const scrollTop = sidebar.scrollTop + (cardRect.top - sidebarRect.top) - offset
  
  // Smooth scroll to the position
  sidebar.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  })
  
  // Center map on selected location (with or without zoom)
  const day = currentTripData.days[index]
  if (shouldZoomMap) {
    // Zoom to location (View Location button or Enter key)
    map.setView(day.coordinates, 10)
  } else {
    // Just center without changing zoom (pin click or day click)
    map.panTo(day.coordinates)
  }
  
  // Highlight marker
  markers.forEach((marker, i) => {
    if (i === index) {
      marker.openPopup()
    }
  })
  
  // Update images on desktop
  if (window.innerWidth > 768) {
    showLocationImages(day)
  }
}

// Add markers to map
function addMapMarkers(tripDays) {
  tripDays.forEach((day, index) => {
    const marker = L.marker(day.coordinates).addTo(map)
    
    // Simple, minimal popup with just essential info
    marker.bindPopup(`
      <div style="text-align: center; padding: 5px;">
        <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: #333;">${day.day}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: #666; font-weight: 500;">${day.city}</p>
      </div>
    `)
    
    // When marker is clicked, select the corresponding day
    marker.on('click', () => {
      currentSelectedDay = index
      selectDay(index) // Don't zoom map on marker click
      updateKeyboardFocus()
    })
    
    markers.push(marker)
  })
}

// Draw route on map
function drawRoute(tripDays) {
  const routeCoordinates = tripDays.map(day => day.coordinates)
  
  const routeLine = L.polyline(routeCoordinates, {
    color: '#007bff',
    weight: 3,
    opacity: 0.7
  }).addTo(map)
  
  // Fit map to show entire route
  map.fitBounds(routeLine.getBounds(), { padding: [20, 20] })
}

// Fetch images from Wikimedia Commons (free, no API key needed)
async function fetchWikimediaImages(location, country) {
  const queries = [
    `${location} architecture`,
    `${location} cathedral church`,
    `${location} historic building`,
    `${location} landscape view`,
    `${location} ${country} tourism`,
    `${location} monument`,
    `${location} city center`,
    `${location} landmark`
  ]
  
  const images = []
  
  for (const query of queries) {
    try {
      // Search for images in Wikimedia Commons using the proper API
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=5&srinfo=totalhits&srprop=size|wordcount|timestamp|snippet`
      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()
      
      if (searchData.query && searchData.query.search.length > 0) {
        for (const file of searchData.query.search) {
          const filename = file.title.replace('File:', '')
          
          // Skip files that are likely not photos (SVG, diagrams, etc.)
          if (filename.toLowerCase().includes('.svg') || 
              filename.toLowerCase().includes('diagram') ||
              filename.toLowerCase().includes('map') ||
              filename.toLowerCase().includes('logo')) {
            continue
          }
          
          try {
            // Get the actual image URL with better error handling
            const imageUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=400`
            const imageResponse = await fetch(imageUrl)
            const imageData = await imageResponse.json()
            
            const pages = imageData.query.pages
            const pageId = Object.keys(pages)[0]
            
            if (pages[pageId].imageinfo && pages[pageId].imageinfo[0]) {
              const imageInfo = pages[pageId].imageinfo[0]
              if (imageInfo.thumburl && imageInfo.mime && imageInfo.mime.startsWith('image/')) {
                images.push({
                  url: imageInfo.thumburl,
                  caption: `${location} - ${filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').replace(/_/g, ' ')}`,
                  alt: `${location} ${query}`,
                  source: 'Wikimedia Commons'
                })
              }
            }
          } catch (imageError) {
            console.log('Failed to fetch image details for:', filename)
          }
          
          if (images.length >= 6) break
        }
      }
    } catch (error) {
      console.log('Wikimedia search failed for:', query, error)
    }
    
    if (images.length >= 6) break
  }
  
  return images
}

// Fetch location-specific images using OpenStreetMap Nominatim + Wikipedia
async function fetchLocationFromNominatim(location, country) {
  try {
    const query = `${location}, ${country}`
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&extratags=1`
    
    const response = await fetch(nominatimUrl)
    const data = await response.json()
    
    if (data.length > 0) {
      const place = data[0]
      const wikidata = place.extratags?.wikidata
      
      if (wikidata) {
        // Get Wikipedia article and images
        const wikipediaImages = await fetchWikipediaImages(wikidata, location)
        if (wikipediaImages.length > 0) {
          return wikipediaImages
        }
      }
    }
  } catch (error) {
    console.log('Nominatim search failed:', error)
  }
  
  return []
}

// Fetch images from Wikipedia/Wikidata
async function fetchWikipediaImages(wikidataId, location) {
  try {
    // Get Wikipedia article from Wikidata
    const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${wikidataId}&props=sitelinks`
    const wikidataResponse = await fetch(wikidataUrl)
    const wikidataData = await wikidataResponse.json()
    
    const entity = wikidataData.entities[wikidataId]
    const enWiki = entity.sitelinks?.enwiki?.title
    
    if (enWiki) {
      // Get images from Wikipedia article
      const wikiImagesUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(enWiki)}&prop=images&imlimit=10`
      const wikiImagesResponse = await fetch(wikiImagesUrl)
      const wikiImagesData = await wikiImagesResponse.json()
      
      const pages = wikiImagesData.query.pages
      const pageId = Object.keys(pages)[0]
      const images = pages[pageId].images || []
      
      const imagePromises = images
        .filter(img => img.title.match(/\.(jpg|jpeg|png|gif)$/i))
        .slice(0, 5)
        .map(async (img) => {
          try {
            const imageInfoUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(img.title)}&prop=imageinfo&iiprop=url&iiurlwidth=400`
            const imageInfoResponse = await fetch(imageInfoUrl)
            const imageInfoData = await imageInfoResponse.json()
            
            const imgPages = imageInfoData.query.pages
            const imgPageId = Object.keys(imgPages)[0]
            
            if (imgPages[imgPageId].imageinfo && imgPages[imgPageId].imageinfo[0].thumburl) {
              return {
                url: imgPages[imgPageId].imageinfo[0].thumburl,
                caption: `${location} - ${img.title.replace('File:', '').replace(/\.(jpg|jpeg|png|gif)$/i, '')}`,
                alt: `${location} architecture`,
                source: 'Wikipedia'
              }
            }
          } catch (error) {
            console.log('Failed to fetch image info:', error)
          }
          return null
        })
      
      const resolvedImages = await Promise.all(imagePromises)
      return resolvedImages.filter(img => img !== null)
    }
  } catch (error) {
    console.log('Wikipedia images fetch failed:', error)
  }
  
  return []
}

// Curated high-quality images for specific locations
function getCuratedLocationImages(location, country) {
  const locationImages = {
    'Berlin': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Brandenburg_Gate_at_night.jpg/400px-Brandenburg_Gate_at_night.jpg', caption: 'Brandenburg Gate - Berlin', alt: 'Brandenburg Gate' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Berlin_Cathedral_and_TV_Tower.jpg/400px-Berlin_Cathedral_and_TV_Tower.jpg', caption: 'Berlin Cathedral and TV Tower', alt: 'Berlin Cathedral' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Reichstag_building_Berlin_view_from_west_before_sunset.jpg/400px-Reichstag_building_Berlin_view_from_west_before_sunset.jpg', caption: 'Reichstag Building - Berlin', alt: 'Reichstag' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Museum_Island_Berlin_July_2009.jpg/400px-Museum_Island_Berlin_July_2009.jpg', caption: 'Museum Island - Berlin', alt: 'Museum Island' }
    ],
    'Bruges': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Brugge_Belfort_viewed_from_Markt.jpg/400px-Brugge_Belfort_viewed_from_Markt.jpg', caption: 'Belfry of Bruges - Market Square', alt: 'Belfry of Bruges' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Bruges_canals.jpg/400px-Bruges_canals.jpg', caption: 'Historic Canals of Bruges', alt: 'Bruges canals' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Bruges_-_Church_of_Our_Lady.jpg/400px-Bruges_-_Church_of_Our_Lady.jpg', caption: 'Church of Our Lady - Bruges', alt: 'Church of Our Lady' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Bruges_Rozenhoedkaai.jpg/400px-Bruges_Rozenhoedkaai.jpg', caption: 'Rozenhoedkaai - Bruges', alt: 'Rozenhoedkaai' }
    ],
    'Bayeux': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Bayeux_Cathedral.jpg/400px-Bayeux_Cathedral.jpg', caption: 'Bayeux Cathedral - Notre-Dame', alt: 'Bayeux Cathedral' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bayeux_Tapestry_scene51_Harold_death.jpg/400px-Bayeux_Tapestry_scene51_Harold_death.jpg', caption: 'Bayeux Tapestry - Historic Art', alt: 'Bayeux Tapestry' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Bayeux_-_Rue_Saint-Martin.jpg/400px-Bayeux_-_Rue_Saint-Martin.jpg', caption: 'Historic Streets of Bayeux', alt: 'Bayeux streets' }
    ],
    'Omaha Beach': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Omaha_Beach_Memorial.jpg/400px-Omaha_Beach_Memorial.jpg', caption: 'Omaha Beach - D-Day Memorial', alt: 'Omaha Beach Memorial' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Normandy_American_Cemetery.jpg/400px-Normandy_American_Cemetery.jpg', caption: 'American Cemetery - Normandy', alt: 'American Cemetery' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Pointe_du_Hoc_monument.jpg/400px-Pointe_du_Hoc_monument.jpg', caption: 'Pointe du Hoc - D-Day Site', alt: 'Pointe du Hoc' }
    ],
    'Mont-Saint-Michel': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Mont_Saint_Michel_3%2C_Brittany%2C_France_-_July_2011.jpg/400px-Mont_Saint_Michel_3%2C_Brittany%2C_France_-_July_2011.jpg', caption: 'Mont-Saint-Michel Abbey', alt: 'Mont-Saint-Michel' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Mont_Saint-Michel_vu_depuis_Tombelaine.jpg/400px-Mont_Saint-Michel_vu_depuis_Tombelaine.jpg', caption: 'Mont-Saint-Michel from Bay', alt: 'Mont-Saint-Michel bay view' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mont_Saint_Michel_interior.jpg/400px-Mont_Saint_Michel_interior.jpg', caption: 'Mont-Saint-Michel Interior', alt: 'Abbey interior' }
    ],
    'Saint-Malo': [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Saint-Malo_city_walls.jpg/400px-Saint-Malo_city_walls.jpg', caption: 'Saint-Malo City Walls', alt: 'Saint-Malo walls' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Saint_Malo_aerial_view.jpg/400px-Saint_Malo_aerial_view.jpg', caption: 'Saint-Malo - Aerial View', alt: 'Saint-Malo aerial' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Fort_National_Saint_Malo.jpg/400px-Fort_National_Saint_Malo.jpg', caption: 'Fort National - Saint-Malo', alt: 'Fort National' }
    ]
  }
  
  return locationImages[location] || []
}

// Main function to get location images
async function getLocationImages(location, country) {
  console.log(`Fetching images for: ${location}, ${country}`)
  
  // Primary source: Wikimedia Commons (free, dynamic, location-specific)
  const wikimediaImages = await fetchWikimediaImages(location, country)
  if (wikimediaImages.length > 0) {
    return wikimediaImages
  }
  
  // Secondary: Try curated images for known locations
  const curatedImages = getCuratedLocationImages(location, country)
  if (curatedImages.length > 0) {
    return curatedImages
  }
  
  // Third: Try getting images from OpenStreetMap Nominatim + Wikipedia
  const nominatimImages = await fetchLocationFromNominatim(location, country)
  if (nominatimImages.length > 0) {
    return nominatimImages
  }
  
  // Final fallback: Simple location-based images from Wikimedia Commons
  const basicWikimediaImages = await fetchBasicWikimediaImages(location, country)
  if (basicWikimediaImages.length > 0) {
    return basicWikimediaImages
  }
  
  // If all else fails, return a single informative message
  return [{
    url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPiR7bG9jYXRpb259PC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNjAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZXMgbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=',
    caption: `${location} - Images not available`,
    alt: `${location}`,
    source: 'Fallback'
  }]
}

// Show location images in slideshow with lazy loading
async function showLocationImages(locationOrDay, country) {
  const slideshow = document.getElementById('image-slideshow')
  const slidesContainer = document.getElementById('slides-container')
  const dotsContainer = document.getElementById('slideshow-dots')
  const loadingIndicator = document.querySelector('.loading-indicator')
  
  // Show loading state
  slideshow.style.display = 'block'
  loadingIndicator.style.display = 'block'
  slidesContainer.innerHTML = ''
  dotsContainer.innerHTML = ''
  
  try {
    let imageLocations = []
    let location, countryName
    
    // Determine what to search for
    if (typeof locationOrDay === 'object' && locationOrDay.images && locationOrDay.images.length > 0) {
      // Use specific image locations from the Images field
      imageLocations = locationOrDay.images
      location = locationOrDay.city
      countryName = locationOrDay.country
    } else {
      // Fallback to general location search
      location = typeof locationOrDay === 'string' ? locationOrDay : locationOrDay.city
      countryName = country || (typeof locationOrDay === 'object' ? locationOrDay.country : '')
      imageLocations = [location]
    }
    
    // Create cache key for this location
    const cacheKey = `${location}_${countryName}_${imageLocations.join('|')}`
    
    // Check if images are already cached
    if (imageCache.has(cacheKey)) {
      console.log('Using cached images for:', location)
      const cachedImages = imageCache.get(cacheKey)
      displayCachedImages(cachedImages)
      return
    }
    
    // Check if preloading is in progress
    if (preloadingPromises.has(cacheKey)) {
      console.log('Waiting for preloading to complete for:', location)
      const images = await preloadingPromises.get(cacheKey)
      displayCachedImages(images)
      return
    }
    
    // Load first image immediately for instant display
    console.log('Loading first image for:', imageLocations[0])
    const firstImages = await getLocationImages(imageLocations[0], countryName)
    
    if (firstImages.length > 0) {
      currentImages = [firstImages[0]] // Start with just the first image
      currentSlideIndex = 0
      
      // Hide loading indicator
      loadingIndicator.style.display = 'none'
      
      // Create first slide
      createSlide(firstImages[0], 0, true)
      createDot(0, true)
      
      // Load remaining images progressively in background
      loadRemainingImagesInBackground(imageLocations, countryName, location, firstImages.slice(1), cacheKey)
    } else {
      throw new Error('No images found for location')
    }
    
  } catch (error) {
    console.error('Error loading images:', error)
    loadingIndicator.innerHTML = '<div>Error loading images</div>'
  }
}

// Display cached images immediately
function displayCachedImages(images) {
  const loadingIndicator = document.querySelector('.loading-indicator')
  
  currentImages = images
  currentSlideIndex = 0
  
  // Hide loading indicator
  loadingIndicator.style.display = 'none'
  
  // Create all slides and dots
  images.forEach((image, index) => {
    createSlide(image, index, index === 0)
    createDot(index, index === 0)
  })
}

// Helper function to create a slide
function createSlide(image, index, isActive = false) {
  const slidesContainer = document.getElementById('slides-container')
  const slide = document.createElement('div')
  slide.className = `slide ${isActive ? 'active' : ''}`
  slide.innerHTML = `
    <img src="${image.url}" alt="${image.alt}" onerror="this.style.display='none'">
    <div class="slide-caption">${image.caption}</div>
  `
  slidesContainer.appendChild(slide)
}

// Helper function to create a dot
function createDot(index, isActive = false) {
  const dotsContainer = document.getElementById('slideshow-dots')
  const dot = document.createElement('div')
  dot.className = `dot ${isActive ? 'active' : ''}`
  dot.addEventListener('click', () => goToSlide(index))
  dotsContainer.appendChild(dot)
}

// Load remaining images progressively in background
async function loadRemainingImagesInBackground(imageLocations, country, location, remainingFirstLocationImages, cacheKey) {
  let allImages = [currentImages[0], ...remainingFirstLocationImages]
  
  // Load images from other specified locations
  for (let i = 1; i < imageLocations.length; i++) {
    try {
      const locationImages = await getLocationImages(imageLocations[i], country)
      allImages.push(...locationImages)
      
      // Add each new image as it loads (if slideshow is still open)
      const slideshow = document.getElementById('image-slideshow')
      if (slideshow && slideshow.style.display === 'block') {
        locationImages.forEach(image => {
          const newIndex = currentImages.length
          currentImages.push(image)
          createSlide(image, newIndex)
          createDot(newIndex)
        })
      }
    } catch (error) {
      console.error(`Error loading images for ${imageLocations[i]}:`, error)
    }
  }
  
  // If we don't have enough images and we haven't searched the main location yet
  if (allImages.length < 3 && !imageLocations.includes(location)) {
    try {
      const mainLocationImages = await getLocationImages(location, country)
      allImages.push(...mainLocationImages)
      
      // Add to current slideshow if still open
      const slideshow = document.getElementById('image-slideshow')
      if (slideshow && slideshow.style.display === 'block') {
        mainLocationImages.forEach(image => {
          const newIndex = currentImages.length
          currentImages.push(image)
          createSlide(image, newIndex)
          createDot(newIndex)
        })
      }
    } catch (error) {
      console.error(`Error loading images for main location ${location}:`, error)
    }
  }
  
  // Cache the complete set of images
  imageCache.set(cacheKey, allImages)
  console.log(`Cached ${allImages.length} images for ${location}`)
}

// Change slide
function changeSlide(direction) {
  if (currentImages.length === 0) return
  
  currentSlideIndex += direction
  
  if (currentSlideIndex >= currentImages.length) {
    currentSlideIndex = 0
  } else if (currentSlideIndex < 0) {
    currentSlideIndex = currentImages.length - 1
  }
  
  updateSlideshow()
}

// Go to specific slide
function goToSlide(index) {
  currentSlideIndex = index
  updateSlideshow()
}

// Update slideshow display
function updateSlideshow() {
  const slides = document.querySelectorAll('.slide')
  const dots = document.querySelectorAll('.dot')
  
  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === currentSlideIndex)
  })
  
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlideIndex)
  })
}

// Close slideshow
function closeSlideshow() {
  document.getElementById('image-slideshow').style.display = 'none'
  document.querySelector('.loading-indicator').style.display = 'block'
}

// Start background image preloading for all trip days
function startBackgroundImagePreloading(days) {
  console.log('Starting background image preloading for', days.length, 'days')
  
  // Clear existing preload queue
  preloadQueue = []
  
  // Add all days to preload queue
  days.forEach((day, index) => {
    preloadQueue.push({ day, index, priority: index === 0 ? 'high' : 'low' })
  })
  
  // Start preloading with a small delay to avoid blocking the main thread
  setTimeout(() => {
    processPreloadQueue()
  }, 100)
}

// Process the preload queue
async function processPreloadQueue() {
  // Sort queue by priority (high priority first)
  preloadQueue.sort((a, b) => a.priority === 'high' ? -1 : 1)
  
  for (const item of preloadQueue) {
    await preloadImagesForDay(item.day, item.index)
    
    // Small delay between requests to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}

// Preload images for a specific day
async function preloadImagesForDay(day, dayIndex) {
  try {
    let imageLocations = []
    let location = day.city
    let country = day.country
    
    // Determine what to search for
    if (day.images && day.images.length > 0) {
      imageLocations = day.images
    } else {
      imageLocations = [location]
    }
    
    // Create cache key
    const cacheKey = `${location}_${country}_${imageLocations.join('|')}`
    
    // Skip if already cached or being preloaded
    if (imageCache.has(cacheKey) || preloadingPromises.has(cacheKey)) {
      return
    }
    
    console.log(`Preloading images for Day ${dayIndex + 1}: ${location}`)
    
    // Create promise for this preload operation
    const preloadPromise = preloadImagesForLocation(imageLocations, country, location)
    preloadingPromises.set(cacheKey, preloadPromise)
    
    // Wait for preload to complete
    const images = await preloadPromise
    
    // Cache the results
    imageCache.set(cacheKey, images)
    preloadingPromises.delete(cacheKey)
    
    console.log(`Preloaded ${images.length} images for ${location}`)
    
  } catch (error) {
    console.error(`Error preloading images for ${day.city}:`, error)
  }
}

// Preload images for a specific location
async function preloadImagesForLocation(imageLocations, country, location) {
  let allImages = []
  
  // Load images from all specified locations
  for (const imageLocation of imageLocations) {
    try {
      const locationImages = await getLocationImages(imageLocation, country)
      allImages.push(...locationImages)
    } catch (error) {
      console.error(`Error loading images for ${imageLocation}:`, error)
    }
  }
  
  // If we don't have enough images and we haven't searched the main location yet
  if (allImages.length < 3 && !imageLocations.includes(location)) {
    try {
      const mainLocationImages = await getLocationImages(location, country)
      allImages.push(...mainLocationImages)
    } catch (error) {
      console.error(`Error loading images for main location ${location}:`, error)
    }
  }
  
  return allImages
}

// Helper function to show images for a specific day by index
function showLocationImagesForDay(dayIndex) {
  if (currentTripData && currentTripData.days && currentTripData.days[dayIndex]) {
    showLocationImages(currentTripData.days[dayIndex])
  }
}

// View location function for button clicks
function viewLocation(dayIndex) {
  if (currentTripData && currentTripData.days && currentTripData.days[dayIndex]) {
    // Update current selected day
    currentSelectedDay = dayIndex
    
    // Zoom map and show images
    selectDay(dayIndex, true) // true = shouldZoomMap
    updateKeyboardFocus()
    showLocationImages(currentTripData.days[dayIndex])
  }
}

// Global functions for HTML onclick events
window.changeSlide = changeSlide
window.goToSlide = goToSlide
window.closeSlideshow = closeSlideshow
window.showLocationImages = showLocationImages
window.showLocationImagesForDay = showLocationImagesForDay
window.viewLocation = viewLocation

// Basic Wikimedia Commons search as final fallback
async function fetchBasicWikimediaImages(location, country) {
  try {
    const simpleQuery = `${location}`
    const searchUrl = `https://commons.wikimedia.org/w/api.php?` +
      `action=query` +
      `&format=json` +
      `&origin=*` +
      `&list=search` +
      `&srsearch=${encodeURIComponent(simpleQuery)}` +
      `&srnamespace=6` +
      `&srlimit=3` +
      `&srprop=snippet`
    
    const response = await fetch(searchUrl)
    const data = await response.json()
    
    if (data.query && data.query.search.length > 0) {
      const images = []
      
      for (const file of data.query.search) {
        const filename = file.title.replace('File:', '')
        
        // Only process image files
        if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          try {
            const imageUrl = `https://commons.wikimedia.org/w/api.php?` +
              `action=query` +
              `&format=json` +
              `&origin=*` +
              `&titles=File:${encodeURIComponent(filename)}` +
              `&prop=imageinfo` +
              `&iiprop=url` +
              `&iiurlwidth=400`
            
            const imageResponse = await fetch(imageUrl)
            const imageData = await imageResponse.json()
            
            const pages = imageData.query.pages
            const pageId = Object.keys(pages)[0]
            
            if (pages[pageId].imageinfo && pages[pageId].imageinfo[0].thumburl) {
              images.push({
                url: pages[pageId].imageinfo[0].thumburl,
                caption: `${location} - ${filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '').replace(/_/g, ' ')}`,
                alt: `${location}`,
                source: 'Wikimedia Commons (basic)'
              })
            }
          } catch (error) {
            console.log('Failed to fetch basic image:', filename)
          }
        }
        
        if (images.length >= 3) break
      }
      
      return images
    }
  } catch (error) {
    console.log('Basic Wikimedia search failed:', error)
  }
  
  return []
}

// Mobile touch gesture support for slideshow
function addTouchGestures() {
  const slideshow = document.getElementById('image-slideshow')
  let startX = 0
  let startY = 0
  let isDragging = false
  
  slideshow.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    isDragging = true
  }, { passive: true })
  
  slideshow.addEventListener('touchmove', (e) => {
    if (!isDragging) return
    
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const diffX = startX - currentX
    const diffY = startY - currentY
    
    // Prevent vertical scrolling while swiping horizontally
    if (Math.abs(diffX) > Math.abs(diffY)) {
      e.preventDefault()
    }
  }, { passive: false })
  
  slideshow.addEventListener('touchend', (e) => {
    if (!isDragging) return
    
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const diffX = startX - endX
    const diffY = startY - endY
    
    // Check if it's a horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        changeSlide(1) // Swipe left = next
      } else {
        changeSlide(-1) // Swipe right = previous
      }
    }
    
    isDragging = false
  }, { passive: true })
}

// Improve map interaction on mobile
function enhanceMapForMobile() {
  // Add better mobile controls
  if (window.innerWidth <= 768) {
    map.options.scrollWheelZoom = false
    map.options.doubleClickZoom = true
    map.options.touchZoom = true
    map.options.dragging = true
    
    // Add zoom control for mobile
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map)
  }
}

// Handle zoom controls when window is resized
function handleZoomControlsOnResize() {
  const isMobile = window.innerWidth <= 768
  const existingControls = document.querySelector('.mobile-zoom-controls')
  
  if (isMobile && !existingControls) {
    // Add mobile controls if we're on mobile and don't have them
    addMobileZoomControls()
    // Hide default leaflet zoom controls
    const leafletZoom = document.querySelector('.leaflet-control-zoom')
    if (leafletZoom) {
      leafletZoom.style.display = 'none'
    }
  } else if (!isMobile && existingControls) {
    // Remove mobile controls if we're on desktop
    existingControls.remove()
    // Show default leaflet zoom controls
    const leafletZoom = document.querySelector('.leaflet-control-zoom')
    if (leafletZoom) {
      leafletZoom.style.display = 'block'
    }
  }
}

// Open manual copy modal when clipboard fails
function openManualCopyModal(textToCopy) {
  const fallbackModal = document.createElement('div')
  fallbackModal.className = 'manual-copy-modal'
  fallbackModal.style.position = 'fixed'
  fallbackModal.style.top = '0'
  fallbackModal.style.left = '0'
  fallbackModal.style.width = '100%'
  fallbackModal.style.height = '100%'
  fallbackModal.style.backgroundColor = 'rgba(0,0,0,0.5)'
  fallbackModal.style.zIndex = '10000'
  fallbackModal.style.display = 'flex'
  fallbackModal.style.alignItems = 'center'
  fallbackModal.style.justifyContent = 'center'
  
  const fallbackContent = document.createElement('div')
  fallbackContent.style.backgroundColor = 'white'
  fallbackContent.style.padding = '20px'
  fallbackContent.style.borderRadius = '8px'
  fallbackContent.style.maxWidth = '90%'
  fallbackContent.style.maxHeight = '80%'
  fallbackContent.style.overflow = 'auto'
  fallbackContent.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
  
  fallbackContent.innerHTML = `
    <div style="margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 1.2rem;">Copy Prompt Template</h3>
      <p style="margin: 0; color: #666; font-size: 0.9rem;">The text below is already selected. Press Cmd+C (Mac) or Ctrl+C (Windows) to copy:</p>
    </div>
    <textarea readonly style="width: 100%; height: 300px; margin: 10px 0; font-family: monospace; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; padding: 8px; background: #f9f9f9;" id="manual-copy-textarea">${textToCopy}</textarea>
    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
      <button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">Close</button>
      <button onclick="selectAllText()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">Select All</button>
    </div>
  `
  
  fallbackModal.appendChild(fallbackContent)
  document.body.appendChild(fallbackModal)
  
  // Auto-select the text
  const textarea = fallbackContent.querySelector('#manual-copy-textarea')
  setTimeout(() => {
    textarea.focus()
    textarea.select()
  }, 100)
  
  // Add global function to select all text
  window.selectAllText = function() {
    textarea.focus()
    textarea.select()
  }
  
  // Close modal when clicking outside
  fallbackModal.addEventListener('click', (e) => {
    if (e.target === fallbackModal) {
      fallbackModal.remove()
      delete window.selectAllText
    }
  })
  
  // Close modal with Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      fallbackModal.remove()
      delete window.selectAllText
      document.removeEventListener('keydown', escapeHandler)
    }
  }
  document.addEventListener('keydown', escapeHandler)
}

// Setup keyboard navigation for desktop
function setupKeyboardNavigation() {
  // Only enable keyboard navigation on desktop
  if (window.innerWidth <= 768) return
  
  const sidebar = document.querySelector('.sidebar')
  
  // Make sidebar focusable for visual feedback
  sidebar.setAttribute('tabindex', '0')
  
  // Track when sidebar is focused for visual feedback
  sidebar.addEventListener('focus', () => {
    sidebarFocused = true
    sidebar.classList.add('keyboard-focused')
    // Show keyboard hint more prominently when focused
    const hint = document.getElementById('keyboard-hint')
    if (hint) {
      hint.style.background = '#e3f2fd'
      hint.style.borderColor = '#2196f3'
    }
  })
  
  sidebar.addEventListener('blur', () => {
    sidebarFocused = false
    sidebar.classList.remove('keyboard-focused')
    // Reset keyboard hint appearance
    const hint = document.getElementById('keyboard-hint')
    if (hint) {
      hint.style.background = '#f8f9fa'
      hint.style.borderColor = '#e0e0e0'
    }
  })
  
  // Handle keyboard events globally
  document.addEventListener('keydown', handleKeyboardNavigation)
  
  // Handle window resize to enable/disable keyboard navigation
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      sidebarFocused = false
      sidebar.classList.remove('keyboard-focused')
    }
  })
}

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
  // Only handle keyboard navigation on desktop
  if (window.innerWidth <= 768 || !currentTripData) return
  
  const slideshow = document.getElementById('image-slideshow')
  const isSlideshow = slideshow && slideshow.style.display === 'block'
  
  // Check if we're in a text input or textarea
  const activeElement = document.activeElement
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    return
  }
  
  switch(e.key) {
    case 'ArrowUp':
      e.preventDefault()
      navigateToDay(currentSelectedDay - 1)
      break
      
    case 'ArrowDown':
      e.preventDefault()
      navigateToDay(currentSelectedDay + 1)
      break
      
    case 'ArrowLeft':
      e.preventDefault()
      if (isSlideshow) {
        changeSlide(-1)
      }
      break
      
    case 'ArrowRight':
      e.preventDefault()
      if (isSlideshow) {
        changeSlide(1)
      }
      break
      
    case 'Enter':
      e.preventDefault()
      if (!isSlideshow) {
        // Zoom map and show images for current day
        selectDay(currentSelectedDay, true) // true = shouldZoomMap
        showLocationImages(currentTripData.days[currentSelectedDay])
      }
      break
      
    case 'Escape':
      e.preventDefault()
      if (isSlideshow) {
        closeSlideshow()
      }
      break
  }
}

// Navigate to a specific day via keyboard
function navigateToDay(dayIndex) {
  if (!currentTripData || !currentTripData.days) return
  
  // Clamp day index to valid range
  dayIndex = Math.max(0, Math.min(dayIndex, currentTripData.days.length - 1))
  
  currentSelectedDay = dayIndex
  selectDay(dayIndex) // This will handle image updates
  
  // Update visual focus indicator
  updateKeyboardFocus()
}

// Update visual focus indicator for keyboard navigation
function updateKeyboardFocus() {
  const dayCards = document.querySelectorAll('.day-card')
  dayCards.forEach((card, index) => {
    if (index === currentSelectedDay) {
      card.classList.add('keyboard-selected')
    } else {
      card.classList.remove('keyboard-selected')
    }
  })
}
