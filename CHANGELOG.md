# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
