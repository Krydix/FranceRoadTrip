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
  
  // Add mobile enhancements
  addTouchGestures()
  enhanceMapForMobile()
  
  // Handle window resize for mobile/desktop switching
  window.addEventListener('resize', () => {
    enhanceMapForMobile()
  })
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
        <img src="${image.url}" alt="${image.alt}" onerror="this.style.display='none'">
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

// Call touch gestures and map enhancements on load
document.addEventListener('DOMContentLoaded', () => {
  addTouchGestures()
  enhanceMapForMobile()
})
