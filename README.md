# Floorplan Card

A Lovelace card for rendering 2D floorplans in Home Assistant with room boundaries, static entities, and tracked devices.

## Features

- Display 2D floorplans for selected floors
- Visualize room boundaries with color-coded rooms
- Show beacon node positions for BLE tracking
- Show static entity positions
- Track moving entities using Bermuda or other location providers
- Automatic room color assignment based on type
- Responsive canvas rendering
- Rotation support (0-360 degrees)

## Installation

### Via HACS

1. Go to **HACS > Frontend**
2. Click **"Explore & Download Repositories"**
3. Search for **"Floorplan Card"**
4. Click **"Download"**
5. Restart Home Assistant

### Manual Installation

1. Build the card: `npm run build`
2. Copy `dist/floorplan-card.js` to your Home Assistant `www` folder
3. Add the following to your dashboard:

```yaml
resources:
  - url: /local/floorplan-card.js
    type: module
```

## Configuration

Add a custom card to your dashboard:

```yaml
type: custom:floorplan-card
title: Floorplan
floor_id: ground_floor
service_domain: floorplan
```

### Configuration Options

- `title` (string, optional): Card title (default: "Floorplan")
- `floor_id` (string, optional): ID of the floor to display (default: "ground_floor")
- `service_domain` (string, optional): Domain of the floorplan service (default: "floorplan")
- `rotation` (number, optional): Rotation angle in degrees (0-360, default: 0)
- `full_width` (boolean, optional): Use full width layout (default: false)
- `theme` (string, optional): Color theme override - `'auto'` (detect from HA), `'light'`, or `'dark'` (default: "auto")

### Example with Rotation

```yaml
type: custom:floorplan-card
title: My Floorplan
floor_id: ground_floor
rotation: 90  # Rotate view 90 degrees clockwise
full_width: true
```

### Example with Theme Override

```yaml
type: custom:floorplan-card
title: My Floorplan
floor_id: ground_floor
theme: dark  # Force dark theme regardless of HA theme
```

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Development Server

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

## How It Works

1. **Room Rendering**: Fetches floorplan data from the Floorplan integration
2. **Coordinate System**: Uses the same meter-based coordinate system as the integration
3. **World-to-Canvas Transform**: Automatically scales room boundaries to fit the canvas
4. **Grid Reference**: Shows a reference grid for coordinate visualization

## Visual Elements

- **Rooms**: Color-coded polygons with labels
- **Beacon Nodes**: Green circles with MAC address labels (last 4 characters)
- **Walls**: Thin gray lines representing room boundaries (0.1m thickness scaled to view)

## Future Features

- Entity position overlay (static and moving)
- Interactive entity selection
- Zone editing mode
- Real-time moving entity tracking
- Support for multiple floors with smooth transitions
