import './style.css';

// Trip data for 7-day camping journey from Berlin to Normandy/Brittany
const tripData = [
  {
    day: 1,
    date: "July 18, 2025",
    location: "Berlin to Bruges",
    coordinates: [51.2093, 3.2247],
    description: "Journey begins at 15:00 - Travel to beautiful Bruges",
    camping: {
      name: "Camping Klein Strand",
      address: "Veltemweg 109, 8000 Bruges, Belgium",
      amenities: ["Showers", "Restaurant", "WiFi", "Bike rental"]
    },
    route: {
      distance: "360 km",
      duration: "3.5 hours",
      highlights: ["Stop in Hannover", "Cross into Netherlands", "Enter Belgium"]
    },
    activities: [
      "Explore Bruges old town",
      "Visit Market Square",
      "Canal boat tour",
      "Try Belgian beer"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 2,
    date: "July 19, 2025",
    location: "Bruges to Bayeux",
    coordinates: [49.2764, -0.7030],
    description: "Travel to historic Bayeux, gateway to Normandy",
    camping: {
      name: "Camping Municipal de Bayeux",
      address: "Boulevard d'Eindhoven, 14400 Bayeux, France",
      amenities: ["Heated pool", "Restaurant", "WiFi", "Laundry"]
    },
    route: {
      distance: "290 km",
      duration: "3 hours",
      highlights: ["Cross into France", "Drive through Normandy countryside"]
    },
    activities: [
      "Visit Bayeux Cathedral",
      "See the Bayeux Tapestry",
      "Explore medieval town center",
      "Try Norman cuisine"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 3,
    date: "July 20, 2025",
    location: "D-Day Beaches",
    coordinates: [49.3370, -0.5500],
    description: "Explore the historic D-Day landing beaches",
    camping: {
      name: "Camping de la Plage",
      address: "Rue de la Mer, 14117 Arromanches, France",
      amenities: ["Beach access", "Restaurant", "WiFi", "Playground"]
    },
    route: {
      distance: "50 km",
      duration: "Multiple stops",
      highlights: ["Omaha Beach", "Pointe du Hoc", "American Cemetery"]
    },
    activities: [
      "Omaha Beach memorial",
      "Arromanches D-Day Museum",
      "Pointe du Hoc monument",
      "American Cemetery visit"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 4,
    date: "July 21, 2025",
    location: "Mont-Saint-Michel",
    coordinates: [48.6361, -1.5115],
    description: "Visit the magical Mont-Saint-Michel abbey",
    camping: {
      name: "Camping du Mont-Saint-Michel",
      address: "Route du Mont-Saint-Michel, 50170 Beauvoir, France",
      amenities: ["Shuttle to Mont", "Restaurant", "WiFi", "Pool"]
    },
    route: {
      distance: "120 km",
      duration: "1.5 hours",
      highlights: ["Scenic coastal drive", "First view of Mont-Saint-Michel"]
    },
    activities: [
      "Explore Mont-Saint-Michel Abbey",
      "Walk the ramparts",
      "Watch tidal changes",
      "Evening illumination"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 5,
    date: "July 22, 2025",
    location: "Saint-Malo",
    coordinates: [48.6490, -2.0251],
    description: "Discover the pirate city of Saint-Malo",
    camping: {
      name: "Camping Aleth",
      address: "Cité d'Aleth, 35400 Saint-Malo, France",
      amenities: ["Sea view", "Restaurant", "WiFi", "Direct beach access"]
    },
    route: {
      distance: "50 km",
      duration: "1 hour",
      highlights: ["Coastal drive", "Brittany coastline"]
    },
    activities: [
      "Walk the city walls",
      "Explore Intra-Muros",
      "Visit Fort National",
      "Enjoy fresh seafood"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 6,
    date: "July 23, 2025",
    location: "Quimper",
    coordinates: [47.9960, -4.1030],
    description: "Experience authentic Breton culture in Quimper",
    camping: {
      name: "Camping de l'Orangerie de Lanniron",
      address: "Château de Lanniron, 29000 Quimper, France",
      amenities: ["Castle grounds", "Pool", "Restaurant", "WiFi"]
    },
    route: {
      distance: "200 km",
      duration: "2.5 hours",
      highlights: ["Breton countryside", "Traditional villages"]
    },
    activities: [
      "Explore Quimper Cathedral",
      "Visit Breton art museums",
      "Traditional Breton dinner",
      "Local market visit"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  },
  {
    day: 7,
    date: "July 24, 2025",
    location: "Return to Berlin",
    coordinates: [52.5200, 13.4050],
    description: "Journey back to Berlin via scenic route",
    camping: {
      name: "Overnight in Luxembourg",
      address: "Camping Kockelscheuer, Luxembourg",
      amenities: ["Pool", "Restaurant", "WiFi", "Playground"]
    },
    route: {
      distance: "850 km",
      duration: "8 hours",
      highlights: ["Stop in Luxembourg", "Scenic German countryside"]
    },
    activities: [
      "Early morning departure",
      "Lunch in Luxembourg",
      "Arrive Berlin by evening",
      "Prepare for car return"
    ],
    image: "https://images.unsplash.com/photo-1559371787-99d8e7d7f6e8?w=400&h=300&fit=crop"
  }
];

// Initialize the application
class RoadTripPlanner {
  constructor() {
    this.map = null;
    this.markers = [];
    this.currentDay = 0;
    this.polyline = null;
    this.init();
  }

  init() {
    this.initMap();
    this.renderItinerary();
    this.showDayDetails(0);
  }

  initMap() {
    // Initialize Leaflet map
    this.map = L.map('map').setView([50.0, 2.0], 6);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add markers for each day
    tripData.forEach((day, index) => {
      const marker = L.marker(day.coordinates)
        .addTo(this.map)
        .bindPopup(`
          <div class="popup-content">
            <h3>Day ${day.day}: ${day.location}</h3>
            <p>${day.description}</p>
            <button onclick="app.showDayDetails(${index})">View Details</button>
          </div>
        `);

      // Custom marker styling
      const customIcon = L.divIcon({
        className: 'day-marker',
        html: day.day,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      marker.setIcon(customIcon);
      
      this.markers.push(marker);
    });

    // Draw route line
    this.drawRoute();
  }

  drawRoute() {
    const coordinates = tripData.map(day => day.coordinates);
    this.polyline = L.polyline(coordinates, {
      color: '#667eea',
      weight: 4,
      opacity: 0.8
    }).addTo(this.map);
  }

  renderItinerary() {
    const itineraryList = document.getElementById('itinerary-list');
    itineraryList.innerHTML = '';

    tripData.forEach((day, index) => {
      const dayItem = document.createElement('div');
      dayItem.className = 'day-item';
      dayItem.innerHTML = `
        <div class="day-number">Day ${day.day}</div>
        <div class="day-location">${day.location}</div>
        <div class="day-description">${day.description}</div>
      `;
      
      dayItem.addEventListener('click', () => this.showDayDetails(index));
      itineraryList.appendChild(dayItem);
    });
  }

  showDayDetails(dayIndex) {
    const day = tripData[dayIndex];
    this.currentDay = dayIndex;

    // Update active day in sidebar
    document.querySelectorAll('.day-item').forEach((item, index) => {
      item.classList.toggle('active', index === dayIndex);
    });

    // Update day details
    document.getElementById('current-day-title').textContent = `Day ${day.day}: ${day.location}`;
    document.getElementById('current-day-content').innerHTML = `
      <div class="day-details">
        <div class="day-info">
          <div class="info-section camping-info">
            <h4>🏕️ Camping</h4>
            <p><strong>${day.camping.name}</strong></p>
            <p>${day.camping.address}</p>
            <p>Amenities: ${day.camping.amenities.join(', ')}</p>
          </div>
          
          <div class="info-section route-info">
            <h4>🚗 Route</h4>
            <p><strong>Distance:</strong> ${day.route.distance}</p>
            <p><strong>Duration:</strong> ${day.route.duration}</p>
            <p><strong>Highlights:</strong> ${day.route.highlights.join(', ')}</p>
          </div>
          
          <div class="info-section activities-info">
            <h4>🎯 Activities</h4>
            <ul>
              ${day.activities.map(activity => `<li>${activity}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div class="day-image">
          <img src="${day.image}" alt="${day.location}" class="location-image" />
          <div class="info-section">
            <h4>📅 ${day.date}</h4>
            <p>${day.description}</p>
          </div>
        </div>
      </div>
    `;

    // Center map on selected day
    this.map.setView(day.coordinates, 10);
  }

  // Method to update images with real photos (placeholder for now)
  async loadLocationImages() {
    // In a real application, you would fetch images from APIs like:
    // - Unsplash API
    // - Google Places API
    // - Wikipedia API
    // For now, using placeholder images
  }
}

// Initialize the app
const app = new RoadTripPlanner();
window.app = app; // Make app globally accessible for popup buttons
