import './style.css'
import L from 'leaflet'

// Global variables
let map
let currentSlideIndex = 0
let currentImages = []
let markers = []
let routeLines = [] // Store all route polylines
let routeMap = new Map() // Track routes by stop key to avoid duplicates
let currentTripData = null
let imageCache = new Map() // Cache for preloaded images
let preloadingPromises = new Map() // Track ongoing preloading
let preloadQueue = [] // Queue for background preloading
let currentSelectedDay = 0 // Track currently selected day for keyboard navigation
let sidebarFocused = false // Track if sidebar has focus for keyboard navigation

// Campsite-related variables
let campsiteMarkers = []
let campsiteLayer = null
let runningCampsiteRequest = null
let campsiteDisplayMode = 'nearest' // 'all', 'nearest', 'none'

// Campsite constants
const CAMPSITE_API_URL = "https://opencampingmap.org/getcampsites"
const MIN_ZOOM_FOR_CAMPSITES = 8
const NEAREST_CAMPSITES_COUNT = 5

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeMap()
  loadAndRenderTrip()
  setupModalHandlers()
  setupKeyboardNavigation()
  setupCampsiteControls()
  
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
      // Load default trip from public/trip.md (showcase Berlin→Normandy)
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
        throw new Error('Failed to load trip file')
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

// Cache for OSM location lookups to avoid repeated API calls
const locationCache = new Map()

// Load cache from localStorage on startup
function loadLocationCache() {
  try {
    const cached = localStorage.getItem('locationCache')
    if (cached) {
      const parsed = JSON.parse(cached)
      Object.entries(parsed).forEach(([key, value]) => {
        locationCache.set(key, value)
      })
      console.log(`📦 Loaded ${locationCache.size} cached locations from localStorage`)
    }
  } catch (error) {
    console.warn('Failed to load location cache:', error)
  }
}

// Save cache to localStorage
function saveLocationCache() {
  try {
    const cacheObj = Object.fromEntries(locationCache)
    localStorage.setItem('locationCache', JSON.stringify(cacheObj))
  } catch (error) {
    console.warn('Failed to save location cache:', error)
  }
}

// Initialize cache on load
loadLocationCache()

// Extract address components from location string
function extractAddressFromLocation(locationString) {
  // Remove quotes
  locationString = locationString.replace(/['"]/g, '')
  
  // Try to extract address after comma (e.g., "Name, Street 123, City" -> "Street 123, City")
  const parts = locationString.split(',').map(s => s.trim())
  
  if (parts.length >= 2) {
    // Return everything except the first part (skip the name)
    return parts.slice(1).join(', ')
  }
  
  return locationString
}

// Extract partial name by removing location-specific suffixes
// E.g., "Parking des Faux de Verzy" -> "Parking des Faux"
function extractPartialName(locationString) {
  locationString = locationString.replace(/['"]/g, '')
  
  const parts = locationString.split(',').map(s => s.trim())
  if (parts.length === 0) return null
  
  const name = parts[0]
  
  // Remove common location suffixes: "de [City]", "à [City]", etc.
  const patterns = [
    / de [A-Z][a-zÀ-ÿ]+$/i,  // "de Verzy"
    / à [A-Z][a-zÀ-ÿ]+$/i,   // "à Paris"
    / en [A-Z][a-zÀ-ÿ]+$/i,  // "en France"
    / sur [A-Z][a-zÀ-ÿ]+$/i, // "sur Mer"
    / - [A-Z][a-zÀ-ÿ]+$/i    // "- Bruges"
  ]
  
  for (const pattern of patterns) {
    const shortened = name.replace(pattern, '').trim()
    if (shortened !== name && shortened.length > 5) {
      return shortened
    }
  }
  
  return null
}

// Resolve location string to coordinates using OSM Nominatim API with fallback
async function resolveLocation(locationString, area = '') {
  // Check cache first
  const cacheKey = `${locationString}|${area}`
  if (locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey)
  }
  
  try {
    // Strategy 1: Try with full location string (name + address)
    let coords = await attemptNominatimSearch(locationString)
    
    if (coords) {
      locationCache.set(cacheKey, coords)
      saveLocationCache() // Persist to localStorage
      console.log(`✓ Found location with full string: ${locationString}`)
      return coords
    }
    
    // Strategy 2: Try with just address (remove business/place name)
    const addressOnly = extractAddressFromLocation(locationString)
    if (addressOnly !== locationString) {
      coords = await attemptNominatimSearch(addressOnly)
      
      if (coords) {
        locationCache.set(cacheKey, coords)
        saveLocationCache() // Persist to localStorage
        console.log(`✓ Found location with address fallback: ${addressOnly}`)
        return coords
      }
    }
    
    // Strategy 3: Try partial name match (e.g., "Parking des Faux de Verzy" -> "Parking des Faux")
    const partialName = extractPartialName(locationString)
    if (partialName && partialName !== locationString) {
      coords = await attemptNominatimSearch(partialName)
      
      if (coords) {
        locationCache.set(cacheKey, coords)
        saveLocationCache()
        console.log(`✓ Found location with partial name: ${partialName}`)
        return coords
      }
    }
    
    // Strategy 4: Try with area context if provided
    if (area) {
      const withArea = `${addressOnly}, ${area}`
      coords = await attemptNominatimSearch(withArea)
      
      if (coords) {
        locationCache.set(cacheKey, coords)
        saveLocationCache() // Persist to localStorage
        console.log(`✓ Found location with area context: ${withArea}`)
        return coords
      }
    }
    
    // Strategy 5: Try structured query with street and city
    coords = await attemptStructuredSearch(locationString, area)
    
    if (coords) {
      locationCache.set(cacheKey, coords)
      saveLocationCache() // Persist to localStorage
      console.log(`✓ Found location with structured search`)
      return coords
    }
    
    // Strategy 6: Last resort - search by amenity type + city from area
    if (area) {
      coords = await attemptAmenitySearch(locationString, area)
      
      if (coords) {
        locationCache.set(cacheKey, coords)
        saveLocationCache()
        console.log(`✓ Found location with amenity search`)
        return coords
      }
    }
    
    console.warn(`⚠ Location not found after all strategies: ${locationString}`)
    return null
    
  } catch (error) {
    console.error(`Error resolving location "${locationString}":`, error)
    return null
  }
}

// Attempt a single Nominatim search query
async function attemptNominatimSearch(query) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      `q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RoadTripPlanner/1.0'
        }
      }
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    
    return null
  } catch (error) {
    console.error('Nominatim search error:', error)
    return null
  }
}

// Try structured search with extracted components
async function attemptStructuredSearch(locationString, area) {
  try {
    // Extract street number and name
    const streetMatch = locationString.match(/([^,]+\s+\d+)/i)
    const cityMatch = area.match(/^([^,]+)/)
    
    if (!streetMatch || !cityMatch) {
      return null
    }
    
    const street = streetMatch[1].trim()
    const city = cityMatch[1].trim()
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'RoadTripPlanner/1.0'
        }
      }
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Try amenity-based search (parking, restaurant, etc.) in specific area
async function attemptAmenitySearch(locationString, area) {
  try {
    // Extract amenity type from name
    const name = locationString.split(',')[0].trim().toLowerCase()
    let amenityType = null
    
    if (name.includes('parking')) amenityType = 'parking'
    else if (name.includes('restaurant') || name.includes('brasserie')) amenityType = 'restaurant'
    else if (name.includes('café') || name.includes('coffee')) amenityType = 'cafe'
    else if (name.includes('hotel')) amenityType = 'hotel'
    else if (name.includes('camping') || name.includes('camp')) amenityType = 'camp_site'
    
    if (!amenityType) return null
    
    // Extract city from area
    const cityMatch = area.match(/^([^,]+)/)
    if (!cityMatch) return null
    
    const city = cityMatch[1].trim()
    
    // Search for amenity in city
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      `q=${encodeURIComponent(amenityType)}+${encodeURIComponent(city)}&format=json&limit=3&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RoadTripPlanner/1.0'
        }
      }
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    
    // Try to find best match by checking if name parts match
    const nameParts = name.split(/\s+/).filter(p => p.length > 3)
    
    for (const result of data) {
      const resultName = (result.display_name || '').toLowerCase()
      
      // Check if any significant name parts match
      const matchCount = nameParts.filter(part => 
        resultName.includes(part.toLowerCase())
      ).length
      
      if (matchCount >= Math.min(2, nameParts.length / 2)) {
        return [parseFloat(result.lat), parseFloat(result.lon)]
      }
    }
    
    // If no good match, return first result as fallback
    if (data.length > 0) {
      console.log(`  ⚠ Using approximate ${amenityType} location in ${city}`)
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Resolve all stop locations to coordinates (optimized with progressive rendering)
async function resolveStopCoordinates(tripData, progressCallback = null, renderCallback = null) {
  const BATCH_SIZE = 5 // Process 5 locations in parallel
  const BATCH_DELAY = 1000 // 1 second delay between batches (respects OSM rate limits)
  
  // Collect all stops that need resolution (in order)
  const stopsToResolve = []
  for (const day of tripData.days) {
    for (const stop of day.stops) {
      if (stop.location && !stop.coords) {
        stopsToResolve.push({ stop, day })
      }
    }
  }
  
  console.log(`🔍 Resolving ${stopsToResolve.length} locations with progressive rendering...`)
  
  let resolvedCount = 0
  
  // Process in batches
  for (let i = 0; i < stopsToResolve.length; i += BATCH_SIZE) {
    const batch = stopsToResolve.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(stopsToResolve.length / BATCH_SIZE)
    
    console.log(`📍 Processing batch ${batchNumber}/${totalBatches} (${batch.length} locations)...`)
    
    // Resolve all locations in this batch in parallel
    const promises = batch.map(({ stop, day }) => 
      resolveLocation(stop.location, stop.area)
        .then(coords => {
          if (coords) {
            stop.coords = coords
            resolvedCount++
            console.log(`  ✓ ${stop.name}`)
            
            // Immediately render this stop!
            if (renderCallback) {
              renderCallback(stop, day)
            }
            
            // Update progress
            if (progressCallback) {
              progressCallback(resolvedCount, stopsToResolve.length)
            }
            
            return { success: true, stop }
          } else {
            // OSM resolution failed - use fallback coordinates if provided
            if (stop.fallbackCoords) {
              stop.coords = stop.fallbackCoords
              stop.usingFallback = true // Flag for UI warning
              resolvedCount++
              console.warn(`  ⚠️ Using fallback coordinates for ${stop.name}: [${stop.fallbackCoords[0]}, ${stop.fallbackCoords[1]}]`)
              
              // Immediately render this stop with fallback coords
              if (renderCallback) {
                renderCallback(stop, day)
              }
              
              // Update progress
              if (progressCallback) {
                progressCallback(resolvedCount, stopsToResolve.length)
              }
              
              return { success: true, stop, fallback: true }
            } else {
              console.warn(`  ⚠ Failed: ${stop.name} (${stop.location}) - No fallback coordinates provided`)
              return { success: false, stop }
            }
          }
        })
        .catch(error => {
          console.error(`  ✗ Error for ${stop.name}:`, error)
          
          // Even on error, try fallback coordinates
          if (stop.fallbackCoords) {
            stop.coords = stop.fallbackCoords
            stop.usingFallback = true
            resolvedCount++
            console.warn(`  ⚠️ Error fallback: Using provided coordinates for ${stop.name}`)
            
            if (renderCallback) {
              renderCallback(stop, day)
            }
            
            if (progressCallback) {
              progressCallback(resolvedCount, stopsToResolve.length)
            }
            
            return { success: true, stop, fallback: true }
          }
          
          return { success: false, stop, error }
        })
    )
    
    // Wait for all promises in this batch
    await Promise.all(promises)
    
    // Delay before next batch (except for the last batch)
    if (i + BATCH_SIZE < stopsToResolve.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }
  
  console.log(`✅ Resolved ${resolvedCount}/${stopsToResolve.length} locations`)
  
  return tripData
}

// Parse trip markdown into structured data
function parseTripMarkdown(markdown) {
  const lines = markdown.split('\n')
  const tripData = {
    title: '',
    subtitle: '',
    startDate: '',
    endDate: '',
    days: []
  }
  
  let currentDay = null
  let currentStop = null
  let inFrontmatter = false
  let currentField = null
  
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
      else if (line.startsWith('startDate:')) {
        tripData.startDate = line.substring(10).trim().replace(/['"]/g, '')
      }
      else if (line.startsWith('endDate:')) {
        tripData.endDate = line.substring(8).trim().replace(/['"]/g, '')
      }
      continue
    }
    
    // Parse day headers (new format without destination in title)
    if (line.startsWith('## Day ')) {
      // Save previous day with its stops
      if (currentDay && currentDay.stops.length > 0) {
        tripData.days.push(currentDay)
      }
      
      // Parse day number
      const dayNumberMatch = line.match(/## Day (\d+)/)
      const dayNumber = dayNumberMatch ? parseInt(dayNumberMatch[1]) : tripData.days.length + 1
      
      currentDay = {
        id: dayNumber,
        day: `Day ${dayNumber}`,
        stops: []
      }
      currentStop = null
      currentField = null
    }
    
    // Parse stop headers (### Stop X: Type)
    else if (line.startsWith('### Stop ')) {
      // Save previous stop if exists
      if (currentStop && currentDay) {
        currentDay.stops.push(currentStop)
      }
      
      // Extract stop type from header (e.g., "### Stop 1: Sleep" -> "Sleep")
      const stopTypeMatch = line.match(/### Stop \d+:\s*(.+)/)
      const stopTypeHint = stopTypeMatch ? stopTypeMatch[1].trim().toLowerCase() : null
      
      currentStop = {
        name: '',
        type: stopTypeHint || 'sightseeing', // default type
        location: '',
        area: '',
        time: '',
        duration: '',
        travelMode: '',
        travelTime: '',
        coords: null,
        fallbackCoords: null // LLM-provided coordinates as last resort
      }
      currentField = null
    }
    
    // Parse stop fields
    else if (currentStop) {
      if (line.startsWith('**Name:**')) {
        currentStop.name = line.substring(9).trim()
        currentField = null
      }
      else if (line.startsWith('**Type:**')) {
        currentStop.type = line.substring(9).trim().toLowerCase()
        currentField = null
      }
      else if (line.startsWith('**Location:**')) {
        // Extract location from quotes if present
        const locationMatch = line.match(/\*\*Location:\*\*\s*"(.+?)"/)
        if (locationMatch) {
          currentStop.location = locationMatch[1].trim()
        } else {
          currentStop.location = line.substring(13).trim().replace(/['"]/g, '')
        }
        currentField = null
      }
      else if (line.startsWith('**Area:**')) {
        currentStop.area = line.substring(9).trim()
        currentField = null
      }
      else if (line.startsWith('**Coordinates:**')) {
        // Parse fallback coordinates (e.g., "48.1234, 16.5678")
        const coordsText = line.substring(16).trim()
        const coordsMatch = coordsText.match(/([\d.-]+)[,\s]+([\d.-]+)/)
        if (coordsMatch) {
          const lat = parseFloat(coordsMatch[1])
          const lon = parseFloat(coordsMatch[2])
          if (!isNaN(lat) && !isNaN(lon)) {
            currentStop.fallbackCoords = [lat, lon]
            console.log(`📍 Fallback coordinates provided for ${currentStop.name}: [${lat}, ${lon}]`)
          }
        }
        currentField = null
      }
      else if (line.startsWith('**Time:**')) {
        currentStop.time = line.substring(9).trim()
        currentField = null
      }
      else if (line.startsWith('**Duration:**')) {
        currentStop.duration = line.substring(13).trim()
        currentField = null
      }
      else if (line.startsWith('**Travel from previous:**')) {
        const travelInfo = line.substring(25).trim()
        // Parse "car, 2.5 hours" or "foot, 15 minutes" or "public_transport, 30 minutes"
        const travelMatch = travelInfo.match(/^(\w+),\s*(.+)$/)
        if (travelMatch) {
          currentStop.travelMode = travelMatch[1].trim()
          currentStop.travelTime = travelMatch[2].trim()
        }
        currentField = null
      }
    }
  }
  
  // Save last stop and day
  if (currentStop && currentDay) {
    currentDay.stops.push(currentStop)
  }
  if (currentDay && currentDay.stops.length > 0) {
    tripData.days.push(currentDay)
  }
  
  // Validate the parsed data
  if (!tripData.title || tripData.days.length === 0) {
    console.error("Parsing failed: Missing title or no days found", tripData);
    throw new Error('Invalid trip format');
  }
  
  console.log('Parsed trip data (new format):', tripData);
  return tripData
}

// Render the page with parsed trip data
async function renderPage(tripData) {
  currentTripData = tripData
  
  // Update header
  document.querySelector('.header h1').textContent = `🚗 ${tripData.title}`
  document.getElementById('trip-subtitle').textContent = tripData.subtitle
  
  // Clear existing markers and routes
  markers.forEach(marker => map.removeLayer(marker))
  markers = []
  markerMap.clear()
  
  // Clear route tracking
  routeLines.forEach(line => map.removeLayer(line))
  routeLines = []
  routeMap.clear()
  
  map.eachLayer(function(layer) {
    if (layer instanceof L.Polyline) {
      map.removeLayer(layer)
    }
  })
  
  // Render initial itinerary structure (without coordinates)
  const itineraryContainer = document.getElementById('itinerary')
  itineraryContainer.innerHTML = ''
  renderItinerary(tripData.days)
  
  // Show loading overlay with progress
  const loadingOverlay = document.createElement('div')
  loadingOverlay.id = 'loading-overlay'
  loadingOverlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; text-align: center;">
      <div style="font-size: 1.1rem; margin-bottom: 10px; color: #333;">🗺️ Loading locations...</div>
      <div style="width: 100%; max-width: 400px; margin: 0 auto; background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 20px;">
        <div id="loading-progress-bar" style="height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div id="loading-progress-text" style="margin-top: 8px; font-size: 0.85rem; color: #666;">Starting...</div>
    </div>
  `
  document.body.appendChild(loadingOverlay)
  
  // Create a map to track rendered stops
  const renderedStops = new Set()
  
  // Resolve coordinates with progressive rendering
  await resolveStopCoordinates(
    tripData,
    // Progress callback
    (current, total) => {
      const progressBar = document.getElementById('loading-progress-bar')
      const progressText = document.getElementById('loading-progress-text')
      
      if (progressBar && progressText) {
        const percentage = Math.round((current / total) * 100)
        progressBar.style.width = `${percentage}%`
        progressText.textContent = `${current} / ${total} locations resolved (${percentage}%)`
      }
    },
    // Render callback - called immediately when each stop is resolved
    (stop, day) => {
      const stopKey = `${day.id}-${stop.name}`
      
      // Avoid rendering duplicates
      if (renderedStops.has(stopKey)) return
      renderedStops.add(stopKey)
      
      // Add marker with animation
      addSingleMarker(stop, day, tripData.days)
      
      // Update the stop item in the sidebar with coordinates
      updateStopItemWithCoords(stop, day)
    }
  )
  
  // Remove loading overlay with fade out
  if (loadingOverlay) {
    loadingOverlay.style.transition = 'opacity 0.3s ease'
    loadingOverlay.style.opacity = '0'
    setTimeout(() => {
      loadingOverlay.remove()
    }, 300)
  }
  
  // Note: Routes are drawn progressively in drawRoutesToStop() during loading
  // Just fit the map to show all loaded coordinates
  const allCoords = []
  tripData.days.forEach(day => {
    day.stops.forEach(stop => {
      if (stop.coords) allCoords.push(stop.coords)
    })
  })
  
  if (allCoords.length > 0) {
    const bounds = L.latLngBounds(allCoords)
    map.fitBounds(bounds, { padding: [50, 50] })
  }
  
  // Start background image preloading
  startBackgroundImagePreloading(tripData.days)
}

// Add a single marker to the map with animation
function addSingleMarker(stop, day, allDays) {
  if (!stop.coords) return
  
  const dayIndex = allDays.findIndex(d => d.id === day.id)
  const stopIndex = day.stops.findIndex(s => s.name === stop.name)
  
  if (dayIndex === -1 || stopIndex === -1) return
  
  const icon = createStopIcon(stop.type)
  const marker = L.marker(stop.coords, { icon, opacity: 0 }).addTo(map)
  
  // Animate marker appearance
  setTimeout(() => {
    marker.setOpacity(1)
  }, 50)
  
  // Create popup with stop info
  const timeInfo = stop.time ? `<div style="color: #666; font-size: 0.85rem;">${stop.time}</div>` : ''
  const travelInfo = stop.travelMode && stopIndex > 0 ? 
    `<div style="color: ${getTravelModeColor(stop.travelMode)}; font-size: 0.85rem; margin-top: 5px;">
      ${stop.travelMode === 'car' ? '🚗' : stop.travelMode === 'foot' ? '🚶' : '🚌'} ${stop.travelTime || ''}
    </div>` : ''
  
  // Add warning if using fallback coordinates
  const fallbackWarning = stop.usingFallback ? 
    `<div style="background: #fff3cd; color: #856404; padding: 5px; margin-top: 5px; border-radius: 3px; font-size: 0.75rem;">
      ⚠️ Approximate location (LLM estimate)
    </div>` : ''
  
  marker.bindPopup(`
    <div style="text-align: center; padding: 5px;">
      <div style="font-size: 1.2rem; margin-bottom: 5px;">${getStopIcon(stop.type)}</div>
      <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: #333;">${stop.name}</h4>
      <p style="margin: 0; font-size: 0.9rem; color: #666; font-weight: 500;">${day.day} - Stop ${stopIndex + 1}</p>
      ${timeInfo}
      ${travelInfo}
      ${fallbackWarning}
    </div>
  `)
  
  // When marker is clicked, highlight sidebar item and scroll to it
  marker.on('click', () => {
    // Remove previous highlighting
    document.querySelectorAll('.stop-item').forEach(item => {
      item.classList.remove('highlighted')
    })
    
    // Find and highlight the corresponding sidebar item
    const sidebarStop = document.querySelector(`.day-card[data-day="${dayIndex}"] .stop-item[data-stop="${stopIndex}"]`)
    if (sidebarStop) {
      sidebarStop.classList.add('highlighted')
      
      // Expand the day card if not already expanded
      const dayCard = document.querySelector(`.day-card[data-day="${dayIndex}"]`)
      if (dayCard && !dayCard.classList.contains('expanded')) {
        dayCard.classList.add('expanded')
      }
      
      // If it's in a parking group, expand that too
      const parkingGroup = sidebarStop.closest('.parking-group')
      if (parkingGroup && !parkingGroup.classList.contains('expanded')) {
        parkingGroup.classList.add('expanded')
      }
      
      // Scroll sidebar to show the highlighted item
      const sidebar = document.querySelector('.sidebar')
      const sidebarRect = sidebar.getBoundingClientRect()
      const stopRect = sidebarStop.getBoundingClientRect()
      const offset = 100
      
      const scrollTop = sidebar.scrollTop + (stopRect.top - sidebarRect.top) - offset
      sidebar.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      })
    }
    
    currentSelectedDay = dayIndex
    selectDay(dayIndex, false, false)
    updateKeyboardFocus()
  })
  
  // Store marker reference
  const key = `${dayIndex}-${stopIndex}`
  markerMap.set(key, marker)
  markers.push(marker)
}

// Update stop item in sidebar to show it has coordinates (with animation)
function updateStopItemWithCoords(stop, day) {
  const dayIndex = currentTripData.days.findIndex(d => d.id === day.id)
  const stopIndex = day.stops.findIndex(s => s.name === stop.name)
  
  if (dayIndex === -1 || stopIndex === -1) return
  
  const stopItem = document.querySelector(`.day-card[data-day="${dayIndex}"] .stop-item[data-stop="${stopIndex}"]`)
  
  if (stopItem) {
    // Add a subtle flash animation to show it's loaded
    stopItem.style.animation = 'fadeIn 0.5s ease-in'
    stopItem.classList.add('loaded')
    
    // Add indicator - checkmark for normal resolution, warning for fallback
    const stopHeader = stopItem.querySelector('.stop-header')
    if (stopHeader && !stopHeader.querySelector('.loaded-indicator')) {
      const indicator = document.createElement('span')
      indicator.className = 'loaded-indicator'
      
      if (stop.usingFallback) {
        // Warning indicator for fallback coordinates
        indicator.textContent = '⚠️'
        indicator.title = 'Using approximate location (LLM estimate)'
        indicator.style.cssText = 'color: #ff9800; font-size: 0.9rem; margin-left: 5px; opacity: 0; animation: fadeIn 0.3s ease-in forwards; cursor: help;'
      } else {
        // Checkmark for successful OSM resolution
        indicator.textContent = '✓'
        indicator.style.cssText = 'color: #4CAF50; font-size: 0.8rem; margin-left: 5px; opacity: 0; animation: fadeIn 0.3s ease-in forwards;'
      }
      
      stopHeader.appendChild(indicator)
    }
  }
  
  // Draw route segment to this stop if previous stop has coordinates
  drawRoutesToStop(day, stopIndex, currentTripData.days)
  
  // IMPORTANT: Also redraw routes for any NEXT stops that were already rendered
  // (in case they were waiting for this stop's coordinates)
  redrawRoutesForDependentStops(day, stopIndex, currentTripData.days)
}

// Redraw routes for stops that depend on this newly-resolved stop
function redrawRoutesForDependentStops(resolvedDay, resolvedStopIndex, allDays) {
  const resolvedDayIndex = allDays.findIndex(d => d.id === resolvedDay.id)
  if (resolvedDayIndex === -1) return
  
  // Check if next stop on same day has coords (needs redraw)
  if (resolvedStopIndex < resolvedDay.stops.length - 1) {
    const nextStop = resolvedDay.stops[resolvedStopIndex + 1]
    if (nextStop && nextStop.coords) {
      console.log(`  🔄 Redrawing route for ${nextStop.name} after ${resolvedDay.stops[resolvedStopIndex].name} resolved`)
      drawRoutesToStop(resolvedDay, resolvedStopIndex + 1, allDays)
    }
  }
  
  // Check if this is the LAST stop of a day - redraw NEXT day's first stop (sleep) if it exists
  if (resolvedStopIndex === resolvedDay.stops.length - 1 && resolvedDayIndex < allDays.length - 1) {
    const nextDay = allDays[resolvedDayIndex + 1]
    if (nextDay && nextDay.stops.length > 0) {
      const firstStopOfNextDay = nextDay.stops[0]
      if (firstStopOfNextDay && firstStopOfNextDay.coords && firstStopOfNextDay.type === 'sleep') {
        console.log(`  🔄 Redrawing cross-day route for ${firstStopOfNextDay.name} after ${resolvedDay.stops[resolvedStopIndex].name} resolved`)
        drawRoutesToStop(nextDay, 0, allDays)
      }
    }
  }
}

// Draw route segments progressively as stops are loaded
function drawRoutesToStop(day, stopIndex, allDays) {
  const stop = day.stops[stopIndex]
  if (!stop.coords) return
  
  const previousStop = stopIndex > 0 ? day.stops[stopIndex - 1] : null
  const dayIndex = allDays.findIndex(d => d.id === day.id)
  
  // Determine where to draw from based on travel mode transitions
  let startCoords = null
  let shouldDrawReturn = false
  let returnToStop = null
  
  // Special case: Sleep stop as first stop of Day 2+ (new format)
  // This represents where you slept last night, need to draw from previous day's last activity
  if (stopIndex === 0 && stop.type === 'sleep' && dayIndex > 0) {
    const previousDay = allDays[dayIndex - 1]
    if (!previousDay || previousDay.stops.length === 0) return
    
    // Find last stop of previous day (last activity before sleep)
    const lastStopOfPreviousDay = previousDay.stops[previousDay.stops.length - 1]
    if (!lastStopOfPreviousDay || !lastStopOfPreviousDay.coords) return
    
    // Find last parking of previous day to determine if we need a return loop
    let lastParkingOfPreviousDay = null
    for (let i = previousDay.stops.length - 1; i >= 0; i--) {
      if (previousDay.stops[i].type === 'parking') {
        lastParkingOfPreviousDay = previousDay.stops[i]
        break
      }
    }
    
    // If last activity was non-car and there was a parking, draw return path + car route
    if (lastParkingOfPreviousDay && lastParkingOfPreviousDay.coords &&
        lastStopOfPreviousDay.type !== 'parking' &&
        (lastStopOfPreviousDay.travelMode === 'foot' || lastStopOfPreviousDay.travelMode === 'public_transport')) {
      
      // Draw return to parking
      const returnStartCoords = lastStopOfPreviousDay.coords
      const returnColor = getTravelModeColor(lastStopOfPreviousDay.travelMode || 'foot')
      const returnDash = (lastStopOfPreviousDay.travelMode === 'foot' || !lastStopOfPreviousDay.travelMode) ? '5, 10' : 
                         (lastStopOfPreviousDay.travelMode === 'public_transport' ? '10, 5' : '5, 10')
      
      const returnLine = L.polyline([returnStartCoords, lastParkingOfPreviousDay.coords], {
        color: returnColor,
        weight: 3,
        opacity: 0,
        dashArray: returnDash,
        className: 'return-to-parking-line'
      }).addTo(map)
      
      setTimeout(() => {
        returnLine.setStyle({ opacity: 0.7 })
      }, 100)
      
      // Then draw car route from parking to sleep
      startCoords = lastParkingOfPreviousDay.coords
    } else {
      // No parking loop, draw directly from last activity (assume car mode)
      startCoords = lastStopOfPreviousDay.coords
    }
  }
  // Within-day routing (stopIndex > 0)
  else if (stopIndex > 0) {
    // Check if current stop has car mode or is parking (always needs car route)
    if (stop.travelMode === 'car' || stop.type === 'parking') {
      // Find where we last left the car (parking or last car stop)
      let lastCarLocation = null
      
      // Look backwards through THIS day
      for (let i = stopIndex - 1; i >= 0; i--) {
        const checkStop = day.stops[i]
        if (checkStop.type === 'parking' || checkStop.travelMode === 'car') {
          lastCarLocation = checkStop
          break
        }
      }
      
      // If we found a car location in current day and previous stop was non-car
      if (lastCarLocation && lastCarLocation.coords && previousStop &&
          previousStop.type !== 'parking' &&
          (previousStop.travelMode === 'foot' || previousStop.travelMode === 'public_transport')) {
        
        // Draw return path from previous stop back to car
        const returnColor = getTravelModeColor(previousStop.travelMode || 'foot')
        const returnDash = (previousStop.travelMode === 'foot' || !previousStop.travelMode) ? '5, 10' : 
                           (previousStop.travelMode === 'public_transport' ? '10, 5' : '5, 10')
        
        const returnLine = L.polyline([previousStop.coords, lastCarLocation.coords], {
          color: returnColor,
          weight: 3,
          opacity: 0,
          dashArray: returnDash,
          className: 'return-to-parking-line'
        }).addTo(map)
        
        setTimeout(() => {
          returnLine.setStyle({ opacity: 0.7 })
        }, 100)
        
        // Then draw car route from car location to current stop
        startCoords = lastCarLocation.coords
      } else if (previousStop && previousStop.coords) {
        // Just draw from previous stop
        startCoords = previousStop.coords
      }
    }
    // Non-car travel modes (foot/public_transport)
    else if (stop.travelMode === 'foot' || stop.travelMode === 'public_transport') {
      // Check if we're starting from a parking/car stop
      if (previousStop && (previousStop.type === 'parking' || previousStop.travelMode === 'car')) {
        // Starting foot/transit journey from parking/car
        startCoords = previousStop.coords
      } else {
        // Continue foot/transit from previous stop
        for (let i = stopIndex - 1; i >= 0; i--) {
          if (day.stops[i].coords) {
            startCoords = day.stops[i].coords
            break
          }
        }
      }
    }
    // Default case - no specific travel mode
    else {
      // Draw from previous stop with coordinates
      for (let i = stopIndex - 1; i >= 0; i--) {
        if (day.stops[i].coords) {
          startCoords = day.stops[i].coords
          break
        }
      }
    }
  } // Close the "else if (stopIndex > 0)" block
  
  // Draw the main route segment
  if (startCoords) {
    const dayIndex = allDays.findIndex(d => d.id === day.id)
    const routeKey = `${dayIndex}-${stopIndex}` // Unique key for this route segment
    
    // Check if route already exists - if so, remove it first (for redraw scenarios)
    const existingRoute = routeMap.get(routeKey)
    if (existingRoute) {
      map.removeLayer(existingRoute)
      const index = routeLines.indexOf(existingRoute)
      if (index > -1) routeLines.splice(index, 1)
    }
    
    const color = getTravelModeColor(stop.travelMode || 'car')
    const dashArray = stop.travelMode === 'foot' ? '5, 10' : 
                     stop.travelMode === 'public_transport' ? '10, 5' : null
    
    const line = L.polyline([startCoords, stop.coords], {
      color: color,
      weight: 3,
      opacity: 0,
      dashArray: dashArray
    }).addTo(map)
    
    // Store the route
    routeMap.set(routeKey, line)
    routeLines.push(line)
    
    // Animate the line appearing
    setTimeout(() => {
      line.setStyle({ opacity: 0.7 })
    }, 100)
  }
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
  
  // Setup campsite layer
  initializeCampsiteLayer()
  
  // Add map event listeners for campsite updates
  map.on('moveend', updateCampsites)
  map.on('zoomend', updateCampsites)
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

// Initialize campsite layer
function initializeCampsiteLayer() {
  // Create a layer group for campsite markers
  campsiteLayer = L.layerGroup().addTo(map)
}

// Setup campsite controls
function setupCampsiteControls() {
  // Initialize controls only once
  if (document.getElementById('campsite-controls').children.length > 1) {
    return
  }
  
  const campsiteControlContainer = document.getElementById('campsite-controls')
  
  // Create and add controls
  const modes = [
    { id: 'nearest', label: '🏕️ Nearest 5', title: 'Show nearest 5 campsites to your route' },
    { id: 'all', label: '🗺️ All', title: 'Show all campsites in current view' },
    { id: 'none', label: '❌ None', title: 'Hide all campsites' }
  ]
  
  modes.forEach(mode => {
    const button = document.createElement('button')
    button.textContent = mode.label
    button.title = mode.title
    button.className = `campsite-toggle ${mode.id === campsiteDisplayMode ? 'active' : ''}`
    button.dataset.mode = mode.id
    
    button.addEventListener('click', () => {
      setCampsiteDisplayMode(mode.id)
      
      // Update active button
      document.querySelectorAll('.campsite-toggle').forEach(btn => btn.classList.remove('active'))
      button.classList.add('active')
    })
    
    campsiteControlContainer.appendChild(button)
  })
}

// Set campsite display mode
function setCampsiteDisplayMode(mode) {
  campsiteDisplayMode = mode
  updateCampsites()
}

// Update campsites based on current map view and display mode
async function updateCampsites() {
  if (campsiteDisplayMode === 'none') {
    clearCampsites()
    return
  }
  
  const zoom = map.getZoom()
  if (zoom < MIN_ZOOM_FOR_CAMPSITES) {
    clearCampsites()
    return
  }
  
  try {
    const campsites = await fetchCampsites()
    displayCampsites(campsites)
  } catch (error) {
    console.error('Error updating campsites:', error)
  }
}

// Fetch campsites from OpenCampingMap API
async function fetchCampsites() {
  // Cancel any running request
  if (runningCampsiteRequest) {
    runningCampsiteRequest.abort()
  }
  
  const bounds = map.getBounds()
  const bbox = bounds.toBBoxString()
  
  const controller = new AbortController()
  runningCampsiteRequest = controller
  
  const formData = new FormData()
  formData.append('bbox', bbox)
  
  try {
    const response = await fetch(CAMPSITE_API_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    runningCampsiteRequest = null
    
    return data.features || []
  } catch (error) {
    if (error.name === 'AbortError') {
      // Request was cancelled, this is fine
      return []
    }
    throw error
  }
}

// Calculate distance between two points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Find nearest campsites to trip pins
function findNearestCampsites(campsites, count = NEAREST_CAMPSITES_COUNT) {
  if (!currentTripData || !currentTripData.days) {
    return campsites
  }
  
  const tripCoordinates = currentTripData.days
    .filter(day => day.coordinates && day.coordinates.length === 2)
    .map(day => day.coordinates)
  
  if (tripCoordinates.length === 0) {
    return campsites
  }
  
  // Calculate minimum distance from each campsite to any trip pin
  const campsitesWithDistance = campsites.map(campsite => {
    const [campsiteLon, campsiteLat] = campsite.geometry.coordinates
    
    const minDistance = Math.min(...tripCoordinates.map(([tripLat, tripLon]) => 
      calculateDistance(campsiteLat, campsiteLon, tripLat, tripLon)
    ))
    
    return {
      ...campsite,
      minDistanceToTrip: minDistance
    }
  })
  
  // Sort by distance and return the nearest ones
  return campsitesWithDistance
    .sort((a, b) => a.minDistanceToTrip - b.minDistanceToTrip)
    .slice(0, count)
}

// Display campsites on the map
function displayCampsites(campsites) {
  clearCampsites()
  
  let campsitesToShow = campsites
  
  if (campsiteDisplayMode === 'nearest') {
    campsitesToShow = findNearestCampsites(campsites)
  }
  
  campsitesToShow.forEach(campsite => {
    const marker = createCampsiteMarker(campsite)
    if (marker) {
      campsiteMarkers.push(marker)
      campsiteLayer.addLayer(marker)
    }
  })
}

// Create a campsite marker
function createCampsiteMarker(campsite) {
  const [lon, lat] = campsite.geometry.coordinates
  const props = campsite.properties
  
  // Determine campsite category and icon
  const category = props.category || 'standard'
  const isPrivate = props.access && ['private', 'members', 'no'].includes(props.access)
  
  // Create custom icon (simplified version of OpenCampingMap icons)
  const iconColor = getCampsiteIconColor(category, isPrivate)
  const icon = L.divIcon({
    className: 'campsite-marker',
    html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
  
  const marker = L.marker([lat, lon], { icon })
  
  // Create popup content
  const popupContent = createCampsitePopup(campsite)
  marker.bindPopup(popupContent)
  
  return marker
}

// Get campsite icon color based on category and access
function getCampsiteIconColor(category, isPrivate) {
  const colors = {
    backcountry: '#225500',
    group_only: '#552200',
    nudist: '#68228b',
    standard: '#000080',
    camping: '#000080',
    caravan: '#000080'
  }
  
  if (isPrivate) {
    return '#666666'
  }
  
  return colors[category] || colors.standard
}

// Create campsite popup content
function createCampsitePopup(campsite) {
  const props = campsite.properties
  const name = props.name || 'Unnamed Campsite'
  const category = props.category || 'standard'
  const access = props.access || 'public'
  
  let content = `<div class="campsite-popup">
    <h4>${name}</h4>
    <p><strong>Category:</strong> ${category}</p>`
  
  if (access !== 'public') {
    content += `<p><strong>Access:</strong> ${access}</p>`
  }
  
  if (props.operator) {
    content += `<p><strong>Operator:</strong> ${props.operator}</p>`
  }
  
  if (props.website) {
    content += `<p><a href="${props.website}" target="_blank">Website</a></p>`
  }
  
  content += '</div>'
  
  return content
}

// Clear all campsite markers
function clearCampsites() {
  campsiteMarkers.forEach(marker => {
    campsiteLayer.removeLayer(marker)
  })
  campsiteMarkers = []
}

// Get icon/emoji for stop type
function getStopIcon(type) {
  const icons = {
    'start': '🏠',
    'sleep': '🏕️',
    'food': '🍽️',
    'sightseeing': '🏛️',
    'parking': '🅿️',
    'end': '🏁'
  }
  return icons[type] || '📍'
}

// Get color for travel mode
function getTravelModeColor(mode) {
  const colors = {
    'car': '#007bff',
    'foot': '#28a745',
    'public_transport': '#fd7e14'
  }
  return colors[mode] || '#6c757d'
}

// Render itinerary in sidebar
function renderItinerary(tripDays) {
  const itineraryContainer = document.getElementById('itinerary')
  
  tripDays.forEach((day, dayIndex) => {
    const dayCard = document.createElement('div')
    dayCard.className = 'day-card'
    dayCard.setAttribute('data-day', dayIndex)
    
    // Get first location (usually sleep) for day title
    const firstStop = day.stops[0]
    const dayTitle = firstStop ? firstStop.area || firstStop.name : `Day ${day.id}`
    
    // Identify parking groups for this day
    const parkingGroups = identifyParkingGroups(day)
    
    // Create stops list HTML with parking group hierarchy
    let stopsHtml = ''
    let processedIndices = new Set()
    
    day.stops.forEach((stop, stopIndex) => {
      // Skip if already processed as part of parking group
      if (processedIndices.has(stopIndex)) return
      
      const icon = getStopIcon(stop.type)
      const timeDisplay = stop.time || ''
      const durationDisplay = stop.duration ? ` (${stop.duration})` : ''
      
      // Check if this is a parking stop with children
      const parkingGroup = parkingGroups.find(g => g.parkingIndex === stopIndex)
      
      if (parkingGroup && parkingGroup.activities.length > 0) {
        // Render parking stop with children
        stopsHtml += `
          <div class="stop-item parking-group" data-stop="${stopIndex}">
            <div class="stop-header">
              <span class="stop-icon">${icon}</span>
              <span class="stop-name">${stop.name}</span>
              <span class="expand-indicator">▼</span>
            </div>
            <div class="stop-details">
              ${timeDisplay ? `<div class="stop-time">${timeDisplay}${durationDisplay}</div>` : ''}
              ${stop.travelMode && stopIndex > 0 ? `
                <div class="stop-travel" style="color: ${getTravelModeColor(stop.travelMode)}">
                  🚗 ${stop.travelTime || ''}
                </div>
              ` : ''}
            </div>
            <div class="parking-activities">
        `
        
        // Render child activities
        parkingGroup.activities.forEach(({ stop: activityStop, index: activityIndex }) => {
          processedIndices.add(activityIndex)
          const activityIcon = getStopIcon(activityStop.type)
          const activityTime = activityStop.time || ''
          const activityDuration = activityStop.duration ? ` (${activityStop.duration})` : ''
          
          stopsHtml += `
            <div class="stop-item activity-child" data-stop="${activityIndex}">
              <div class="stop-header">
                <span class="stop-icon">${activityIcon}</span>
                <span class="stop-name">${activityStop.name}</span>
              </div>
              <div class="stop-details">
                ${activityTime ? `<div class="stop-time">${activityTime}${activityDuration}</div>` : ''}
                <div class="stop-travel" style="color: ${getTravelModeColor(activityStop.travelMode)}">
                  ${activityStop.travelMode === 'foot' ? '🚶' : '🚌'} ${activityStop.travelTime || ''}
                </div>
              </div>
            </div>
          `
        })
        
        // Add return indicator
        if (parkingGroup.returnToParking) {
          stopsHtml += `
            <div class="return-indicator">
              <span class="return-icon">↩️</span>
              <span class="return-text">Return to parking</span>
            </div>
          `
        }
        
        stopsHtml += `
            </div>
          </div>
        `
        
        // Mark parking stop as processed
        processedIndices.add(stopIndex)
        
      } else {
        // Regular stop (not part of parking group or parking without children)
        stopsHtml += `
          <div class="stop-item" data-stop="${stopIndex}">
            <div class="stop-header">
              <span class="stop-icon">${icon}</span>
              <span class="stop-name">${stop.name}</span>
            </div>
            <div class="stop-details">
              ${timeDisplay ? `<div class="stop-time">${timeDisplay}${durationDisplay}</div>` : ''}
              ${stop.travelMode && stopIndex > 0 ? `
                <div class="stop-travel" style="color: ${getTravelModeColor(stop.travelMode)}">
                  ${stop.travelMode === 'car' ? '🚗' : stop.travelMode === 'foot' ? '🚶' : '🚌'} ${stop.travelTime || ''}
                </div>
              ` : ''}
            </div>
          </div>
        `
      }
    })
    
    dayCard.innerHTML = `
      <div class="day-header">
        <h3>${day.day}</h3>
        <div class="day-location">${dayTitle}</div>
      </div>
      <div class="day-stops">
        ${stopsHtml}
      </div>
    `
    
    // Add click handler for the day card
    dayCard.addEventListener('click', (e) => {
      // Don't toggle if clicking on a stop item
      if (e.target.closest('.stop-item')) {
        return
      }
      
      // Toggle expanded/collapsed state
      dayCard.classList.toggle('expanded')
      
      currentSelectedDay = dayIndex
      selectDay(dayIndex)
      
      if (window.innerWidth > 768) {
        updateKeyboardFocus()
      }
    })
    
    // Add click handlers for parking groups
    const parkingGroupElements = dayCard.querySelectorAll('.parking-group')
    parkingGroupElements.forEach(groupEl => {
      const headerEl = groupEl.querySelector('.stop-header')
      const expandIcon = groupEl.querySelector('.expand-indicator')
      
      // Click on expand arrow - just toggle expansion
      if (expandIcon) {
        expandIcon.addEventListener('click', (e) => {
          e.stopPropagation()
          groupEl.classList.toggle('expanded')
        })
      }
      
      // Click on parking header (not arrow) - zoom to location and toggle
      headerEl.addEventListener('click', (e) => {
        e.stopPropagation()
        
        // Toggle expansion
        groupEl.classList.toggle('expanded')
        
        // Also handle the parking stop click behavior
        const stopIndex = parseInt(groupEl.getAttribute('data-stop'))
        const stop = day.stops[stopIndex]
        
        if (stop && stop.coords) {
          // Remove highlighting from all stops
          document.querySelectorAll('.stop-item').forEach(item => {
            item.classList.remove('highlighted')
          })
          
          // Highlight this parking group
          groupEl.classList.add('highlighted')
          
          // Get the marker for this parking stop
          const key = `${dayIndex}-${stopIndex}`
          const marker = markerMap.get(key)
          
          // Zoom to parking location
          map.setView(stop.coords, 15, {
            animate: true,
            duration: 0.5
          })
          
          // Open popup after zoom animation
          if (marker) {
            setTimeout(() => {
              marker.openPopup()
            }, 600)
          }
        }
      })
    })
    
    // Add click handlers for individual stops (including parking groups)
    const stopItems = dayCard.querySelectorAll('.stop-item')
    stopItems.forEach(stopItem => {
      stopItem.addEventListener('click', (e) => {
        e.stopPropagation() // Don't trigger day card click
        
        const stopIndex = parseInt(stopItem.getAttribute('data-stop'))
        const stop = day.stops[stopIndex]
        
        if (!stop || !stop.coords) {
          console.warn('Stop has no coordinates:', stop)
          return
        }
        
        // Remove highlighting from all stops
        document.querySelectorAll('.stop-item').forEach(item => {
          item.classList.remove('highlighted')
        })
        
        // Highlight this stop
        stopItem.classList.add('highlighted')
        
        // Get the marker for this stop
        const key = `${dayIndex}-${stopIndex}`
        const marker = markerMap.get(key)
        
        // Check if we're already zoomed to this location
        const currentCenter = map.getCenter()
        const isAlreadyThere = Math.abs(currentCenter.lat - stop.coords[0]) < 0.001 && 
                               Math.abs(currentCenter.lng - stop.coords[1]) < 0.001
        
        if (isAlreadyThere && marker) {
          // Second click - toggle popup
          if (marker.isPopupOpen()) {
            marker.closePopup()
          } else {
            marker.openPopup()
          }
        } else {
          // First click - zoom to location
          map.setView(stop.coords, 15, {
            animate: true,
            duration: 0.5
          })
          
          // Open popup after a short delay to let zoom animation complete
          if (marker) {
            setTimeout(() => {
              marker.openPopup()
            }, 600)
          }
        }
      })
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
function selectDay(index, shouldZoomMap = false, shouldMoveMap = true) {
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
  
  // Center map on first stop of the selected day (with or without zoom)
  // Skip if shouldMoveMap is false (e.g., when clicking on a specific pin)
  if (shouldMoveMap) {
    const day = currentTripData.days[index]
    if (day.stops && day.stops.length > 0 && day.stops[0].coords) {
      if (shouldZoomMap) {
        // Zoom to location (View Location button or Enter key)
        map.setView(day.stops[0].coords, 10)
      } else {
        // Just center without changing zoom (pin click or day click)
        const currentZoom = map.getZoom()
        map.setView(day.stops[0].coords, currentZoom)
      }
    }
  }
  
  // Update images on desktop - use first sightseeing stop
  if (window.innerWidth > 768) {
    const sightseeingStop = day.stops.find(s => s.type === 'sightseeing')
    if (sightseeingStop) {
      showLocationImages({
        city: sightseeingStop.name,
        country: sightseeingStop.area || '',
        images: [sightseeingStop.name]
      })
    }
  }
}

// Create custom icon for stop type
function createStopIcon(type) {
  const emoji = getStopIcon(type)
  const colors = {
    'start': '#28a745',    // green for start
    'sleep': '#6f42c1',
    'food': '#fd7e14',
    'sightseeing': '#007bff',
    'parking': '#6c757d',
    'end': '#dc3545'       // red for end
  }
  const color = colors[type] || '#333'
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  })
}

// Add markers to map
// Global map to store marker references by day and stop index
const markerMap = new Map()

function addMapMarkers(tripDays) {
  markerMap.clear()
  
  tripDays.forEach((day, dayIndex) => {
    day.stops.forEach((stop, stopIndex) => {
      if (!stop.coords) {
        console.warn(`No coordinates for stop: ${stop.name}`)
        return
      }
      
      const icon = createStopIcon(stop.type)
      const marker = L.marker(stop.coords, { icon }).addTo(map)
      
      // Create popup with stop info
      const timeInfo = stop.time ? `<div style="color: #666; font-size: 0.85rem;">${stop.time}</div>` : ''
      const travelInfo = stop.travelMode && stopIndex > 0 ? 
        `<div style="color: ${getTravelModeColor(stop.travelMode)}; font-size: 0.85rem; margin-top: 5px;">
          ${stop.travelMode === 'car' ? '🚗' : stop.travelMode === 'foot' ? '🚶' : '🚌'} ${stop.travelTime || ''}
        </div>` : ''
      
      marker.bindPopup(`
        <div style="text-align: center; padding: 5px;">
          <div style="font-size: 1.2rem; margin-bottom: 5px;">${getStopIcon(stop.type)}</div>
          <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: #333;">${stop.name}</h4>
          <p style="margin: 0; font-size: 0.9rem; color: #666; font-weight: 500;">${day.day} - Stop ${stopIndex + 1}</p>
          ${timeInfo}
          ${travelInfo}
        </div>
      `)
      
      // When marker is clicked, highlight sidebar item and scroll to it
      marker.on('click', () => {
        // Remove previous highlighting
        document.querySelectorAll('.stop-item').forEach(item => {
          item.classList.remove('highlighted')
        })
        
        // Find and highlight the corresponding sidebar item
        const sidebarStop = document.querySelector(`.day-card[data-day="${dayIndex}"] .stop-item[data-stop="${stopIndex}"]`)
        if (sidebarStop) {
          sidebarStop.classList.add('highlighted')
          
          // Expand the day card if not already expanded
          const dayCard = document.querySelector(`.day-card[data-day="${dayIndex}"]`)
          if (dayCard && !dayCard.classList.contains('expanded')) {
            dayCard.classList.add('expanded')
          }
          
          // If it's in a parking group, expand that too
          const parkingGroup = sidebarStop.closest('.parking-group')
          if (parkingGroup && !parkingGroup.classList.contains('expanded')) {
            parkingGroup.classList.add('expanded')
          }
          
          // Scroll sidebar to show the highlighted item
          const sidebar = document.querySelector('.sidebar')
          const sidebarRect = sidebar.getBoundingClientRect()
          const stopRect = sidebarStop.getBoundingClientRect()
          const offset = 100
          
          const scrollTop = sidebar.scrollTop + (stopRect.top - sidebarRect.top) - offset
          sidebar.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })
        }
        
        currentSelectedDay = dayIndex
        selectDay(dayIndex, false, false) // Don't move map when clicking a pin!
        updateKeyboardFocus()
      })
      
      // Store marker reference
      const key = `${dayIndex}-${stopIndex}`
      markerMap.set(key, marker)
      markers.push(marker)
    })
  })
}

// Analyze stops to identify parking-based activity groups
function identifyParkingGroups(day) {
  const groups = []
  let currentGroup = null
  
  day.stops.forEach((stop, index) => {
    if (stop.type === 'parking') {
      // Start a new parking group
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentGroup = {
        parkingStop: stop,
        parkingIndex: index,
        activities: [],
        returnToParking: false
      }
    } else if (currentGroup && (stop.travelMode === 'foot' || stop.travelMode === 'public_transport')) {
      // Activity within parking group
      currentGroup.activities.push({ stop, index })
      
      // Check if next stop is car travel or end of day
      const nextStop = day.stops[index + 1]
      if (!nextStop || nextStop.travelMode === 'car') {
        currentGroup.returnToParking = true
        groups.push(currentGroup)
        currentGroup = null
      }
    } else {
      // End current parking group if exists
      if (currentGroup) {
        groups.push(currentGroup)
        currentGroup = null
      }
    }
  })
  
  if (currentGroup) {
    groups.push(currentGroup)
  }
  
  return groups
}

// Draw route on map with color-coded travel modes and parking loops
function drawRoute(tripDays) {
  const allCoords = []
  
  tripDays.forEach(day => {
    const parkingGroups = identifyParkingGroups(day)
    let previousCoords = null
    
    day.stops.forEach((stop, stopIndex) => {
      if (!stop.coords) return
      
      allCoords.push(stop.coords)
      
      // Find if this stop is part of a parking group
      const parkingGroup = parkingGroups.find(g => 
        g.parkingIndex === stopIndex || 
        g.activities.some(a => a.index === stopIndex)
      )
      
      // Draw line from previous stop to this one
      if (previousCoords && stopIndex > 0) {
        const color = getTravelModeColor(stop.travelMode)
        const dashArray = stop.travelMode === 'foot' ? '5, 10' : null
        
        L.polyline([previousCoords, stop.coords], {
          color: color,
          weight: 3,
          opacity: 0.7,
          dashArray: dashArray
        }).addTo(map)
      }
      
      // If this is the last activity in a parking group, draw return line to parking
      if (parkingGroup && parkingGroup.returnToParking) {
        const lastActivity = parkingGroup.activities[parkingGroup.activities.length - 1]
        if (lastActivity.index === stopIndex && parkingGroup.parkingStop.coords) {
          const returnColor = getTravelModeColor(stop.travelMode) // Same mode as last activity
          const returnDash = stop.travelMode === 'foot' ? '5, 10' : null
          
          L.polyline([stop.coords, parkingGroup.parkingStop.coords], {
            color: returnColor,
            weight: 2,
            opacity: 0.5,
            dashArray: returnDash,
            className: 'return-to-parking-line'
          }).addTo(map)
        }
      }
      
      previousCoords = stop.coords
    })
  })
  
  // Fit map to show entire route
  if (allCoords.length > 0) {
    const bounds = L.latLngBounds(allCoords)
    map.fitBounds(bounds, { padding: [50, 50] })
  }
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
    // Find all sightseeing stops for this day
    const sightseeingStops = day.stops.filter(s => s.type === 'sightseeing')
    
    if (sightseeingStops.length === 0) return
    
    for (const stop of sightseeingStops) {
      const imageLocations = [stop.name]
      const location = stop.name
      const country = stop.area || ''
      
      // Create cache key
      const cacheKey = `${location}_${country}_${imageLocations.join('|')}`
      
      // Skip if already cached or being preloaded
      if (imageCache.has(cacheKey) || preloadingPromises.has(cacheKey)) {
        continue
      }
      
      console.log(`Preloading images for ${stop.name} on Day ${dayIndex + 1}`)
      
      // Create promise for this preload operation
      const preloadPromise = preloadImagesForLocation(imageLocations, country, location)
      preloadingPromises.set(cacheKey, preloadPromise)
      
      // Wait for preload to complete
      const images = await preloadPromise
      
      // Cache the results
      imageCache.set(cacheKey, images)
      preloadingPromises.delete(cacheKey)
      
      console.log(`Preloaded ${images.length} images for ${location}`)
    }
    
  } catch (error) {
    console.error(`Error preloading images for day ${dayIndex + 1}:`, error)
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
    
    const day = currentTripData.days[dayIndex]
    const sightseeingStop = day.stops.find(s => s.type === 'sightseeing')
    if (sightseeingStop) {
      showLocationImages({
        city: sightseeingStop.name,
        country: sightseeingStop.area || '',
        images: [sightseeingStop.name]
      })
    }
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