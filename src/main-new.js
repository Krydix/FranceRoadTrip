import './style.css'
import L from 'leaflet'

// Road trip data
const roadTripData = [
  {
    id: 1,
    day: "Day 1",
    date: "July 18, 2025",
    city: "Berlin",
    country: "Germany",
    description: "Departure from Berlin at 15:00. Drive to first overnight stop.",
    camping: "Camping am Werbellinsee",
    coordinates: [52.5200, 13.4050],
    distance: "60 km from Berlin",
    activities: ["Pick up rental car", "Drive to campsite", "Set up camp", "Evening by the lake"]
  },
  {
    id: 2,
    day: "Day 2",
    date: "July 19, 2025",
    city: "Bruges",
    country: "Belgium",
    description: "Full day in beautiful Bruges. Explore medieval architecture and canals.",
    camping: "Camping Klein Strand",
    coordinates: [51.2093, 3.2247],
    distance: "520 km from Berlin",
    activities: ["Historic city center", "Canal boat tour", "Bruges Beer Museum", "Market Square"]
  },
  {
    id: 3,
    day: "Day 3",
    date: "July 20, 2025",
    city: "Bayeux",
    country: "France",
    description: "Drive to Normandy. Visit Bayeux and the famous tapestry.",
    camping: "Camping Municipal de Bayeux",
    coordinates: [49.2765, -0.7032],
    distance: "310 km from Bruges",
    activities: ["Bayeux Tapestry", "Bayeux Cathedral", "Local markets", "Normandy countryside"]
  },
  {
    id: 4,
    day: "Day 4",
    date: "July 21, 2025",
    city: "Omaha Beach",
    country: "France",
    description: "D-Day beaches and historical sites. Visit Omaha Beach and American Cemetery.",
    camping: "Camping de la Plage",
    coordinates: [49.3697, -0.8507],
    distance: "15 km from Bayeux",
    activities: ["Omaha Beach", "American Cemetery", "Overlord Museum", "Pointe du Hoc"]
  },
  {
    id: 5,
    day: "Day 5",
    date: "July 22, 2025",
    city: "Mont-Saint-Michel",
    country: "France",
    description: "Visit the iconic Mont-Saint-Michel abbey and surrounding bay.",
    camping: "Camping du Mont-Saint-Michel",
    coordinates: [48.6359, -1.5115],
    distance: "120 km from Omaha Beach",
    activities: ["Mont-Saint-Michel Abbey", "Bay walks", "Medieval streets", "Tidal phenomena"]
  },
  {
    id: 6,
    day: "Day 6",
    date: "July 23, 2025",
    city: "Saint-Malo",
    country: "France",
    description: "Explore the walled city of Saint-Malo and enjoy Brittany's coast.",
    camping: "Camping Aleth",
    coordinates: [48.6494, -2.0257],
    distance: "50 km from Mont-Saint-Michel",
    activities: ["Walled city exploration", "Fort National", "Beach walks", "Seafood dining"]
  },
  {
    id: 7,
    day: "Day 7",
    date: "July 24, 2025",
    city: "Return to Berlin",
    country: "Germany",
    description: "Long drive back to Berlin. Arrive evening before car return.",
    camping: "Hotel near airport",
    coordinates: [52.5200, 13.4050],
    distance: "800 km to Berlin",
    activities: ["Drive back", "Rest stops", "Arrive Berlin", "Prepare for car return"]
  }
]

// Global variables
let map
let currentSlideIndex = 0
let currentImages = []
let markers = []

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeMap()
  renderItinerary()
  addMapMarkers()
  drawRoute()
})

// Initialize Leaflet map
function initializeMap() {
  map = L.map('map').setView([50.5, 3.0], 6)
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)
}

// Render itinerary in sidebar
function renderItinerary() {
  const itineraryContainer = document.getElementById('itinerary')
  
  roadTripData.forEach((day, index) => {
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
      </div>
    `
    
    dayCard.addEventListener('click', () => {
      selectDay(index)
      showLocationImages(day.city, day.country)
    })
    
    itineraryContainer.appendChild(dayCard)
  })
}

// Select a specific day
function selectDay(index) {
  // Remove active class from all cards
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.remove('active')
  })
  
  // Add active class to selected card
  document.querySelector(`[data-day="${index}"]`).classList.add('active')
  
  // Center map on selected location
  const day = roadTripData[index]
  map.setView(day.coordinates, 10)
  
  // Highlight marker
  markers.forEach((marker, i) => {
    if (i === index) {
      marker.openPopup()
    }
  })
}

// Add markers to map
function addMapMarkers() {
  roadTripData.forEach((day, index) => {
    const marker = L.marker(day.coordinates).addTo(map)
    
    marker.bindPopup(`
      <div>
        <h4>${day.day} - ${day.city}</h4>
        <p>${day.description}</p>
        <div class="popup-images">
          <div style="text-align: center; margin: 10px 0;">
            <a href="#" class="view-all-images" onclick="showLocationImages('${day.city}', '${day.country}')">
              📸 View Images
            </a>
          </div>
        </div>
      </div>
    `)
    
    markers.push(marker)
  })
}

// Draw route on map
function drawRoute() {
  const routeCoordinates = roadTripData.map(day => day.coordinates)
  
  const routeLine = L.polyline(routeCoordinates, {
    color: '#007bff',
    weight: 3,
    opacity: 0.7
  }).addTo(map)
  
  // Fit map to show entire route
  map.fitBounds(routeLine.getBounds(), { padding: [20, 20] })
}

// Fetch images using Unsplash API
async function fetchUnsplashImages(query) {
  const UNSPLASH_ACCESS_KEY = 'YOUR_ACCESS_KEY' // Replace with your Unsplash access key
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&client_id=${UNSPLASH_ACCESS_KEY}`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    return data.results.map(photo => ({
      url: photo.urls.regular,
      caption: photo.alt_description || query,
      alt: photo.alt_description || query
    }))
  } catch (error) {
    console.error('Error fetching Unsplash images:', error)
    return []
  }
}

// Get location images using multiple sources
async function getLocationImages(location, country) {
  // First try Unsplash API (if you have an API key)
  try {
    const unsplashImages = await fetchUnsplashImages(`${location} ${country}`)
    if (unsplashImages.length > 0) {
      return unsplashImages
    }
  } catch (error) {
    console.log('Unsplash API not available, using alternative sources')
  }
  
  // Fallback to using Picsum with predictable seeds based on location
  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const imageQueries = [
    `${location} architecture`,
    `${location} landscape`,
    `${location} historic`,
    `${location} tourism`,
    `${country} culture`
  ]
  
  const images = []
  
  for (let i = 0; i < imageQueries.length; i++) {
    const seed = (locationSeed + i * 100) % 1000
    images.push({
      url: `https://picsum.photos/seed/${seed}/300/200`,
      caption: `${imageQueries[i]}`,
      alt: imageQueries[i]
    })
  }
  
  return images
}

// Show location images in slideshow
async function showLocationImages(location, country) {
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
    currentImages = await getLocationImages(location, country)
    currentSlideIndex = 0
    
    // Hide loading indicator
    loadingIndicator.style.display = 'none'
    
    // Create slides
    currentImages.forEach((image, index) => {
      const slide = document.createElement('div')
      slide.className = `slide ${index === 0 ? 'active' : ''}`
      slide.innerHTML = `
        <img src="${image.url}" alt="${image.alt}" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Loading...'">
        <div class="slide-caption">${image.caption}</div>
      `
      slidesContainer.appendChild(slide)
      
      // Create dot
      const dot = document.createElement('div')
      dot.className = `dot ${index === 0 ? 'active' : ''}`
      dot.addEventListener('click', () => goToSlide(index))
      dotsContainer.appendChild(dot)
    })
    
  } catch (error) {
    console.error('Error loading images:', error)
    loadingIndicator.innerHTML = '<div>Error loading images</div>'
  }
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

// Global functions for HTML onclick events
window.changeSlide = changeSlide
window.goToSlide = goToSlide
window.closeSlideshow = closeSlideshow
window.showLocationImages = showLocationImages
