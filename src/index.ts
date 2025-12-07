/**
 * Home Assistant Floorplan Card
 * A Lovelace card for rendering 2D floorplans
 */

import { FloorplanCard } from './floorplan-card';

export { FloorplanCard } from './floorplan-card';
export { RoomRenderer } from './components/room-renderer';
export type { FloorplanConfig, Room, RoomData, FloorData } from './types';

// Register the card in the window for HA card picker
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'floorplan-card',
  name: 'Floorplan Card',
  description: 'A card for displaying 2D floorplans with room boundaries and entity positions',
  preview: false,
  documentationURL: 'https://github.com/BenWolstencroft/home-assistant-floorplan-card',
});

console.info(
  `%c FLOORPLAN-CARD %c v0.2.1 `,
  'color: white; background: #1976d2; font-weight: 700;',
  'color: #1976d2; background: white; font-weight: 700;'
);
