# Berlin to Normandy Road Trip Planner

A comprehensive web application for planning a 7-day camping road trip from Berlin to Normandy and Brittany, France.

🌐 **Live Demo**: [https://krydix.github.io/FranceRoadTrip/](https://krydix.github.io/FranceRoadTrip/)

## 🚗 Trip Overview

- **Duration**: 7 days (July 18-25, 2025)
- **Route**: Berlin → Bruges → Bayeux → D-Day Beaches → Mont-Saint-Michel → Saint-Malo → Quimper → Berlin
- **Total Distance**: ~2,400 km
- **Countries**: Germany, Belgium, France

## ✨ Features

- **Interactive Map**: OpenStreetMap integration with Leaflet
- **Day-by-Day Itinerary**: Detailed planning for each day
- **Location Images**: Real photos from Wikimedia Commons (no API keys needed)
- **Image Slideshow**: Browse multiple images for each destination
- **Camping Information**: Campsite details and amenities
- **Route Visualization**: Complete route with distance and duration
- **Activity Suggestions**: Things to do at each destination
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Technical Stack

- **Vite**: Fast build tool and development server
- **Vanilla JavaScript**: Modern ES6+ features
- **Leaflet**: Interactive maps
- **OpenStreetMap**: Free map tiles and geocoding
- **Wikimedia Commons API**: Free, location-specific images
- **Modern CSS**: Responsive design with gradients and animations

## 🚀 Getting Started

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

### Deployment

This project is configured for automatic deployment to GitHub Pages:

1. **Push to main branch** - GitHub Actions will automatically build and deploy
2. **Enable Pages** in repository settings (source: GitHub Actions)
3. **Access your site** at `https://yourusername.github.io/repositoryname/`

## 🌐 External APIs (All Free)

- **OpenStreetMap Nominatim**: Geocoding and location data
- **Wikimedia Commons**: Location-specific images
- **Wikipedia API**: Additional location information
- **OpenStreetMap Tiles**: Map visualization

*No API keys required - all services are free and public!*

## 📍 Itinerary Highlights

### Day 1: Berlin to Bruges
- **Distance**: 360 km (3.5 hours)
- **Camping**: Camping Klein Strand
- **Activities**: Explore medieval Bruges, canal tours, Belgian beer

### Day 2: Bruges to Bayeux
- **Distance**: 290 km (3 hours)
- **Camping**: Camping Municipal de Bayeux
- **Activities**: Bayeux Cathedral, Bayeux Tapestry, medieval town

### Day 3: D-Day Beaches
- **Distance**: 50 km (multiple stops)
- **Camping**: Camping de la Plage, Arromanches
- **Activities**: Omaha Beach, Pointe du Hoc, American Cemetery

### Day 4: Mont-Saint-Michel
- **Distance**: 120 km (1.5 hours)
- **Camping**: Camping du Mont-Saint-Michel
- **Activities**: Abbey visit, ramparts walk, tidal changes

### Day 5: Saint-Malo
- **Distance**: 50 km (1 hour)
- **Camping**: Camping Aleth
- **Activities**: City walls, Intra-Muros, Fort National

### Day 6: Quimper
- **Distance**: 200 km (2.5 hours)
- **Camping**: Camping de l'Orangerie de Lanniron
- **Activities**: Quimper Cathedral, Breton culture, local markets

### Day 7: Return to Berlin
- **Distance**: 850 km (8 hours)
- **Overnight**: Luxembourg stop
- **Activities**: Early departure, Luxembourg lunch, Berlin arrival

## 🎯 Usage

1. **Browse Itinerary**: Click on any day in the sidebar to see details
2. **Explore Map**: Interactive map with numbered markers for each day
3. **View Details**: Each day shows camping info, route details, and activities
4. **Responsive**: Works on both desktop and mobile devices

## 📱 Mobile Responsive

The application is fully responsive and works great on:
- Desktop computers
- Tablets
- Mobile phones

## 🔧 Development

### Project Structure
```
src/
├── main.js          # Main application logic
├── style.css        # Styling and responsive design
├── counter.js       # Utility functions
└── javascript.svg   # Assets

public/
└── vite.svg        # Public assets
```

### Key Features
- **Modern JavaScript**: ES6+ modules, async/await, classes
- **Interactive Maps**: Leaflet integration with custom markers
- **Responsive Design**: Mobile-first approach
- **Performance**: Optimized with Vite build tool

## 🏕️ Camping Information

Each location includes:
- Campsite name and address
- Available amenities
- Distance from attractions
- Booking recommendations

## 🗺️ Route Planning

The application provides:
- Turn-by-turn route visualization
- Distance and duration estimates
- Scenic highlights and stops
- Border crossing information

## 📷 Future Enhancements

- Real location images from APIs
- Weather information integration
- Booking links for campsites
- Offline map capabilities
- Route optimization based on traffic

## 📄 License

This project is open source and available under the MIT License.
