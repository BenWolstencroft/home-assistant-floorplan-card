/**
 * Types for the Floorplan card
 */

export interface FloorplanConfig {
  floors?: Record<string, FloorData>;
  rooms?: Record<string, RoomData>;
  static_entities?: Record<string, EntityCoordinates>;
  moving_entities?: Record<string, EntityCoordinates>;
  beacon_nodes?: Record<string, EntityCoordinates>;
}

export interface FloorData {
  name?: string;
  height: number;
}

export interface RoomData {
  name: string;
  floor: string;
  area?: string;
  boundaries: [number, number][];
}

export interface EntityCoordinates {
  coordinates: [number, number, number];
}

export interface Room {
  id: string;
  name: string;
  floor: string;
  area?: string;
  boundaries: [number, number][];
  center?: [number, number];
  area_size?: number;
}

export interface RendererConfig {
  width: number;
  height: number;
  padding: number;
  scale: number;
}
