# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-12-08

### Added
- **Bermuda BLE moving entity tracking** - Real-time rendering of tracked devices on floorplan
- New `MovingEntityData` interface for entity metadata (coordinates, confidence, last_updated)
- Automatic fetching of moving entity coordinates from `get_all_moving_entity_coordinates` service
- Visual differentiation: moving entities as blue/purple circles (8px) vs green beacon nodes (6px)
- Always-visible labels for moving entities showing friendly names from Home Assistant
- Floor height filtering for moving entities (only show entities on current floor)
- Theme-aware colors for moving entities (blue #2196F3 in light mode, purple #9C27B0 in dark mode)

### Changed
- Canvas rotation now correctly transforms mouse coordinates for beacon hover detection
- Room label contrast reduced for better readability (#999/#666 instead of #e0e0e0/#333)
- Room labels no longer bold

### Fixed
- Beacon hover detection now works correctly with canvas rotation applied
- Mouse coordinate scaling accounts for CSS display size vs canvas internal dimensions
- Inverse rotation applied to mouse coordinates before collision detection

## [0.2.9] - 2025-12-08

### Added
- Automatic dark theme support with theme detection
- Theme-aware color palette for all visual elements (background, rooms, borders, text, beacons)
- Dual detection method using Home Assistant's themes.darkMode property with fallback to theme name matching
- Darker background (#1a1a1a) and adjusted room colors for dark themes
- Lighter beacon colors (#66BB6A) and improved contrast for dark mode
- **`theme` configuration option** to override automatic theme detection (`'auto'`, `'light'`, or `'dark'`)

### Changed
- Canvas background color adapts to user's theme (light: #f5f5f5, dark: #1a1a1a)
- Room colors optimized for both light and dark themes
- Text colors automatically adjust for better readability (#e0e0e0 in dark, #333 in light)
- Border colors reduce eye strain in dark mode (#555 vs #999)
- Theme detection now respects user's manual override when `theme` is set in card config

## [0.2.8] - 2025-12-08

### Added
- Automatic text wrapping for room name labels that don't fit within room boundaries
- Smart word-based line breaking with 20px padding from room edges
- Multi-line label support with proper vertical centering

### Changed
- Room labels now wrap across multiple lines when room width is too narrow
- Text wrapping works correctly with canvas rotation

## [0.2.7] - 2025-12-08

### Added
- Beacon node friendly names displayed from Home Assistant device registry
- Support for new beacon data format with `coordinates` and `name` fields

### Changed
- Beacon labels now show device friendly names when available (from HA device registry)
- Falls back to MAC address display (last 4 chars) if no friendly name found
- Maintains backward compatibility with old beacon data format (plain coordinate arrays)

## [0.2.6] - 2025-12-08

### Changed
- Canvas aspect ratio changed from 16:10 to 1:1 (square) for better floorplan visualization

## [0.2.5] - 2025-12-08

### Added
- Beacon node visualization on floorplan (green circles with MAC address labels)
- Beacon nodes display last 4 characters of MAC address for easy identification
- Counter-rotated labels for beacon nodes to maintain readability at any rotation angle
- Floor-specific beacon filtering based on floor range (min to ceiling height)

### Fixed
- Beacon nodes now only appear on the floor they belong to, not on all floors
- Corrected floor filtering logic: beacons shown if Z >= floor_min_height and Z < floor_height
- Floor height represents ceiling of floor, not floor level (e.g., ground=2.4m means 0-2.4m range)

## [0.2.3] - 2025-12-08

### Added
- `rotation` configuration option to rotate the view by degrees (0-360)
- Canvas rotation transform around center point

### Changed
- Wall thickness scaled to 0.1m in real-world coordinates (0.1 * scale pixels)

## [0.2.2] - 2025-12-08

### Fixed
- Add `return_response: true` to service calls (required for SupportsResponse.ONLY services)

## [0.2.1] - 2025-12-07

### Added
- Debug logging for service responses

### Fixed
- Service response data handling

## [0.2.0] - 2025-12-07

### Added
- Dynamic room loading from integration service
- Full width card option (`full_width: true`)
- Auto-scaling and centering of room layouts
- Background data updates without flashing
- Window registration for card picker
- `getCardSize()` and `setConfig()` Home Assistant requirements

### Changed
- Removed static room data - now loads from `floorplan.get_rooms_by_floor` service
- Removed floor selector dropdown - shows only configured floor
- Loading indicator only shows on first load
- Bundled Lit dependencies into card output

### Fixed
- TypeScript decorator configuration
- Type definitions for card data structure
- ESLint configuration with deprecated rules

## [0.1.0] - 2025-12-06

### Added
- Initial release
- 2D floorplan rendering with Lit/TypeScript
- Room boundary visualization with color-coded room types
- Floor selection dropdown
- Canvas-based rendering with grid reference
- Configurable floor display
- Responsive design
- Integration with Floorplan integration services
