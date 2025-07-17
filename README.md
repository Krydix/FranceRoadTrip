# 🚗 France Road Trip Planner

A dynamic, interactive road trip planner web application for exploring France with camping adventures. Built with modern web technologies and featuring real-time map integration, custom trip loading, and AI-powered trip generation.

## 🌟 Features

### 🗺️ Interactive Mapping
- **OpenStreetMap Integration**: Using Leaflet for responsive, interactive maps
- **Real-time Route Visualization**: Automatic route drawing between destinations
- **Custom Map Markers**: Clickable markers with day information
- **Responsive Design**: Works seamlessly on desktop and mobile

### 📱 Dynamic Trip Loading
- **Markdown-Driven**: Load trip data from structured Markdown files
- **Custom Trips**: Paste and load custom trip plans via modal interface
- **LocalStorage**: Automatically saves custom trips for future use
- **Fallback System**: Graceful fallback to default trip if custom loading fails

### 🤖 AI Trip Generation
- **LLM Integration**: Pre-formatted prompt template for AI trip generation
- **Copy-to-Clipboard**: One-click copying of trip generation prompts
- **Safari Compatible**: Robust clipboard functionality across all browsers
- **Current Date Aware**: Automatically includes current date in prompts

### 🖼️ Smart Image System
- **Wikimedia Integration**: Automatic image sourcing from Wikimedia Commons
- **Location-Specific**: Images based on specific landmarks and locations
- **Slideshow Interface**: Interactive image gallery for each destination
- **Fallback Images**: Curated backup images for popular destinations

### 🎯 Modern UI/UX
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Loading States**: Smooth loading indicators and error handling
- **Modal Interfaces**: Clean, accessible modal dialogs
- **Touch Gestures**: Swipe navigation for mobile slideshow

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tool**: Vite for fast development and optimized builds
- **Mapping**: Leaflet.js with OpenStreetMap tiles
- **APIs**: Wikimedia Commons API for image sourcing
- **Deployment**: GitHub Pages with automated GitHub Actions

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Krydix/FranceRoadTrip.git
   cd FranceRoadTrip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

### Development

- **Local Development**: `npm run dev` - Starts Vite dev server at `localhost:5173`
- **Build**: `npm run build` - Creates optimized production build in `dist/`
- **Preview**: `npm run preview` - Preview production build locally

## ⌨️ Keyboard Navigation (Desktop)

The application includes full keyboard navigation support for desktop users:

### Getting Started
1. **Focus the Sidebar**: Click on the sidebar or press `Tab` to focus it
2. **Navigate Between Days**: Use `↑` and `↓` arrow keys to move between days
3. **View Images**: Press `Enter` to open the image slideshow for the selected day
4. **Navigate Images**: Use `←` and `→` arrow keys to navigate through images
5. **Close Slideshow**: Press `Escape` to close the image slideshow

### Visual Indicators
- **Green Border**: Shows the currently selected day via keyboard
- **Blue Outline**: Indicates when the sidebar has keyboard focus
- **Smooth Transitions**: Automatic map centering and marker highlighting

### Key Bindings
- `↑` / `↓` - Navigate between days (when sidebar focused)
- `←` / `→` - Previous/next image (when slideshow open)
- `Enter` - Open image slideshow for selected day
- `Escape` - Close image slideshow
- `Tab` - Focus sidebar for keyboard navigation

## 📋 Trip Format

### Markdown Structure

The application uses a specific Markdown format for trip data:

```markdown
# Trip Title

**Duration:** X days
**Dates:** Start Date - End Date
**Type:** Trip Type

## Day 1: Destination City, Country
**Date:** Full Date
**Coordinates:** latitude, longitude
**Camping:** Campsite Name
**Distance:** Distance from previous location
**Images:** Landmark 1, Landmark 2, Building Name, Natural Feature

Description of the day's activities and highlights.

**Activities:**
- Activity 1
- Activity 2
- Activity 3
```

### Key Guidelines

- **Day Titles**: Use destination format: "Day 1: Prague, Czech Republic" NOT "Day 1: Berlin to Prague"
- **Coordinates**: Required for map markers (latitude, longitude)
- **Images**: Comma-separated list of specific landmarks for photo sourcing
- **Activities**: Bullet-point list of planned activities

## 🎨 Customization

### Adding New Trips

1. **Create Markdown File**: Follow the format above
2. **Load via UI**: Use the "Load Custom Trip" button
3. **Paste Content**: Paste your Markdown trip data
4. **Automatic Parsing**: The app will parse and display your trip

### Image Sources

The app uses multiple image sources in order of priority:
1. **Wikimedia Commons**: Dynamic search based on location
2. **Curated Images**: Hand-picked high-quality images for popular destinations
3. **Fallback System**: Placeholder images if no others available

### Styling

- **CSS Variables**: Easy theme customization in `src/style.css`
- **Responsive Breakpoints**: Mobile-first design with tablet and desktop variants
- **Component Styling**: Modular CSS for easy maintenance

## 🤖 AI Trip Generation

### Using the LLM Prompt

1. **Copy Prompt**: Click "Copy LLM Prompt" in the modal
2. **Paste to AI**: Use with ChatGPT, Claude, or similar LLM
3. **Specify Trip**: Provide start point, destination, duration, and interests
4. **Get Markdown**: AI will generate properly formatted trip
5. **Load Trip**: Paste the generated Markdown back into the app

### Prompt Features

- **Current Date Aware**: Automatically includes today's date
- **Format Specification**: Clear instructions for proper Markdown structure
- **Image Guidelines**: Specific instructions for landmark-based image sourcing
- **Validation Rules**: Ensures coordinates and required fields are included

## 📂 Project Structure

```
FranceRoadTrip/
├── src/
│   ├── main.js          # Main application logic
│   ├── style.css        # Styling and responsive design
│   └── ...
├── public/
│   ├── trip.md          # Default trip data
│   └── ...
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actions deployment
├── prompt-template.md   # LLM prompt template
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🚀 Deployment

### GitHub Pages

The project auto-deploys to GitHub Pages via GitHub Actions:

1. **Push to Main**: Any push to `main` branch triggers deployment
2. **Build Process**: Vite builds the project
3. **Deploy**: Built files are pushed to `gh-pages` branch
4. **Live Site**: Available at `https://username.github.io/FranceRoadTrip/`

### Manual Deployment

For manual deployment:
```bash
npm run build
# Deploy dist/ folder to your hosting service
```

## 🔧 Configuration

### Environment Variables

No environment variables required for basic functionality. All APIs used are public and free.

### Customization

- **Map Tiles**: Change OpenStreetMap tiles in `main.js`
- **Base Path**: Update in `package.json` for different repository names
- **Default Trip**: Edit `public/trip.md` for different default content

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines

- **Code Style**: Use modern JavaScript (ES6+)
- **Comments**: Document complex functions and algorithms
- **Testing**: Test across different browsers and devices
- **Performance**: Optimize for mobile and slow connections

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌐 Live Demo

Visit the live application: [France Road Trip Planner](https://krydix.github.io/FranceRoadTrip/)

## 📞 Support

For support, issues, or feature requests:
- **GitHub Issues**: [Create an issue](https://github.com/Krydix/FranceRoadTrip/issues)
- **Documentation**: Check this README and code comments

## 🎯 Future Enhancements

- [ ] **Multiple Trip Storage**: Save multiple trips locally
- [ ] **Export Features**: Export trips as PDF or GPX
- [ ] **Weather Integration**: Show weather for trip dates
- [ ] **Sharing**: Share trips via URL
- [ ] **Offline Support**: PWA functionality for offline use

---

Built with ❤️ for travel enthusiasts and road trip adventurers!
