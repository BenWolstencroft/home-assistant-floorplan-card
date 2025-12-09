import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { RoomRenderer } from './components/room-renderer';
import { FloorplanConfig, Room } from './types';

interface FloorplanCardConfig extends LovelaceCardConfig {
  title?: string;
  floor_id?: string;
  service_domain?: string;
  full_width?: boolean;
  rotation?: number; // Rotation angle in degrees (0-360)
  theme?: 'light' | 'dark' | 'auto'; // Theme override ('auto' uses HA theme detection)
}

interface BeaconNodeData {
  coordinates: [number, number, number];
  name?: string; // Friendly name from device registry
}

interface MovingEntityData {
  coordinates: [number, number, number];
  confidence?: number;
  last_updated?: string;
}

interface CardFloorplanData {
  rooms: Room[];
  entity_coordinates: Record<string, [number, number, number]>;
  beacon_nodes: Record<string, BeaconNodeData | [number, number, number]>; // Support both old and new format
  moving_entities: Record<string, MovingEntityData>; // Bermuda-tracked entities
  floor_height: number; // Ceiling height of this floor
  floor_min_height: number; // Ceiling height of floor below (or 0 for ground floor)
}

@customElement('floorplan-card')
export class FloorplanCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ type: Object }) public config?: FloorplanCardConfig;
  @state() private floorData?: CardFloorplanData;
  @state() private loading = false;
  @state() private error?: string;
  @state() private hoveredBeacon: string | null = null;
  @state() private hoveredMovingEntity: string | null = null;

  static getStubConfig(): FloorplanCardConfig {
    return {
      type: 'custom:floorplan-card',
      title: 'Floorplan',
      floor_id: 'ground_floor',
      service_domain: 'floorplan',
      full_width: false,
      rotation: 0,
      theme: 'auto',
    };
  }

  public setConfig(config: FloorplanCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (!config.type) {
      throw new Error('Card type is required');
    }
    this.config = config;
    
    // Set layout attribute for full width support
    if (config.full_width) {
      this.setAttribute('layout', 'full-width');
    } else {
      this.removeAttribute('layout');
    }
  }

  public getCardSize(): number {
    // Return the number of grid rows the card should occupy
    // 1 row = approximately 50px in height
    return 5;
  }

  private isDarkTheme(): boolean {
    // Check for config override first
    if (this.config?.theme === 'dark') return true;
    if (this.config?.theme === 'light') return false;
    
    // Auto-detect from Home Assistant theme (default behavior)
    // Home Assistant sets themes attribute on hass object
    if (!this.hass) return false;
    
    // Check if dark mode is explicitly set
    const themes = (this.hass as any).themes;
    if (themes?.darkMode !== undefined) {
      return themes.darkMode;
    }
    
    // Fallback: check selected theme name for 'dark' keyword
    const selectedTheme = (this.hass as any).selectedTheme;
    if (selectedTheme && typeof selectedTheme === 'string') {
      return selectedTheme.toLowerCase().includes('dark');
    }
    
    return false;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .card {
        background: var(--ha-card-background, #fff);
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        padding: 16px;
      }

      .header {
        margin-bottom: 16px;
      }

      .title {
        font-size: 20px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .canvas-container {
        position: relative;
        background: var(--surface-variant);
        border-radius: 8px;
        overflow: hidden;
        aspect-ratio: 1 / 1;
        margin-top: 16px;
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .loading {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }

      .error {
        color: var(--error-color);
        padding: 16px;
        border-radius: 4px;
        background: rgba(244, 67, 54, 0.1);
      }
    `;
  }

  protected firstUpdated(): void {
    this.loadFloorplanData();
    this.setupMouseEvents();
  }

  private setupMouseEvents(): void {
    const canvas = this.shadowRoot?.querySelector<HTMLCanvasElement>('#floorplan-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseleave', () => {
      this.hoveredBeacon = null;
      this.renderFloorplan();
    });
  }

  private handleMouseMove(event: MouseEvent): void {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // Scale mouse coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x = (event.clientX - rect.left) * scaleX;
    let y = (event.clientY - rect.top) * scaleY;

    // If canvas is rotated, apply inverse rotation to mouse coordinates
    const rotation = this.config?.rotation || 0;
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const rotRad = (-rotation * Math.PI) / 180; // Negative for inverse rotation
      
      // Translate to origin
      const dx = x - centerX;
      const dy = y - centerY;
      
      // Rotate
      const cosRot = Math.cos(rotRad);
      const sinRot = Math.sin(rotRad);
      x = dx * cosRot - dy * sinRot + centerX;
      y = dx * sinRot + dy * cosRot + centerY;
    }

    // Check if mouse is over any beacon
    const hoveredMac = this.getBeaconAtPosition(x, y);
    if (hoveredMac !== this.hoveredBeacon) {
      this.hoveredBeacon = hoveredMac;
      this.renderFloorplan();
    }
  }

  private getBeaconAtPosition(mouseX: number, mouseY: number): string | null {
    if (!this.floorData?.beacon_nodes) return null;

    const canvas = this.shadowRoot?.querySelector<HTMLCanvasElement>('#floorplan-canvas');
    if (!canvas) return null;

    // Get the same transform parameters used in drawBeaconNodes
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate bounds and scale (same as drawRoomsFromData)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.floorData.rooms.forEach(room => {
      room.boundaries.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    const padding = 20;
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    const rotation = this.config?.rotation || 0;
    const rotRad = (rotation * Math.PI) / 180;
    const cosRot = Math.abs(Math.cos(rotRad));
    const sinRot = Math.abs(Math.sin(rotRad));
    const rotatedWidth = dataWidth * cosRot + dataHeight * sinRot;
    const rotatedHeight = dataWidth * sinRot + dataHeight * cosRot;
    const scale = Math.min(
      (canvasWidth - 2 * padding) / rotatedWidth,
      (canvasHeight - 2 * padding) / rotatedHeight
    );
    const scaledWidth = dataWidth * scale;
    const scaledHeight = dataHeight * scale;
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;

    const transform = (x: number, y: number): [number, number] => [
      (x - minX) * scale + offsetX,
      (y - minY) * scale + offsetY
    ];

    const floorCeilingHeight = this.floorData.floor_height;
    const floorMinHeight = this.floorData.floor_min_height;
    const beaconRadius = 6;

    // Check each beacon
    for (const [mac, data] of Object.entries(this.floorData.beacon_nodes)) {
      const coords = Array.isArray(data) ? data : data.coordinates;
      const [x, y, z] = coords;
      
      // Only check beacons on this floor
      if (z < floorMinHeight || z >= floorCeilingHeight) continue;

      const [canvasX, canvasY] = transform(x, y);
      const distance = Math.sqrt((mouseX - canvasX) ** 2 + (mouseY - canvasY) ** 2);
      
      if (distance <= beaconRadius) {
        return mac;
      }
    }

    return null;
  }

  protected willUpdate(changedProperties: Map<string, any>): void {
    super.willUpdate(changedProperties);
    
    // Reload data when hass changes (for live updates) - but only after initial load
    if (changedProperties.has('hass') && this.hass && this.config && this.floorData) {
      this.loadFloorplanData();
    }
  }

  private async loadFloorplanData(): Promise<void> {
    if (!this.hass || !this.config) return;

    // Only show loading on first load
    const isFirstLoad = !this.floorData;
    if (isFirstLoad) {
      this.loading = true;
    }
    
    this.error = undefined;

    try {
      // Fetch rooms for the configured floor
      const roomsResponse = await this.hass.callWS({
        type: 'call_service',
        domain: this.config.service_domain || 'floorplan',
        service: 'get_rooms_by_floor',
        service_data: {
          floor_id: this.config.floor_id || 'ground_floor'
        },
        return_response: true
      });

      // Fetch entity coordinates
      const coordsResponse = await this.hass.callWS({
        type: 'call_service',
        domain: this.config.service_domain || 'floorplan',
        service: 'get_all_entity_coordinates',
        service_data: {},
        return_response: true
      });

      // Fetch moving entity coordinates (Bermuda-tracked)
      const movingResponse = await this.hass.callWS({
        type: 'call_service',
        domain: this.config.service_domain || 'floorplan',
        service: 'get_all_moving_entity_coordinates',
        service_data: {},
        return_response: true
      });

      // Combine the data - WebSocket responses have data in 'response' property
      this.floorData = {
        rooms: roomsResponse.response?.rooms || [],
        entity_coordinates: coordsResponse.response?.entity_coordinates || {},
        beacon_nodes: coordsResponse.response?.beacon_nodes || {},
        moving_entities: movingResponse.response?.moving_entities || {},
        floor_height: roomsResponse.response?.floor_height ?? 0.0,
        floor_min_height: roomsResponse.response?.floor_min_height ?? 0.0
      };
    } catch (err) {
      this.error = `Failed to load floorplan data: ${err}`;
      console.error('Floorplan card error:', err);
    } finally {
      if (isFirstLoad) {
        this.loading = false;
      }
    }
  }

  protected render(): TemplateResult {
    if (!this.hass || !this.config) {
      return html`<div class="error">Card not configured</div>`;
    }

    if (this.loading && !this.floorData) {
      return html`<div class="loading">Loading floorplan...</div>`;
    }

    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    return html`
      <div class="card">
        <div class="header">
          <div class="title">${this.config.title || 'Floorplan'}</div>
        </div>

        <div class="canvas-container">
          <canvas id="floorplan-canvas"></canvas>
        </div>
      </div>
    `;
  }

  protected updated(): void {
    if (this.floorData) {
      this.renderFloorplan();
    }
  }

  private renderFloorplan(): void {
    const canvas = this.shadowRoot?.querySelector(
      '#floorplan-canvas'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement as HTMLElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    // Clear canvas with theme-appropriate background
    const isDark = this.isDarkTheme();
    ctx.fillStyle = isDark ? '#1a1a1a' : '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply rotation around center if configured
    const rotation = this.config?.rotation || 0;
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    // Render rooms from integration data
    this.drawRoomsFromData(ctx, canvas.width, canvas.height);

    // Restore canvas state if rotated
    if (rotation !== 0) {
      ctx.restore();
    }
  }

  private drawRoomsFromData(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.floorData?.rooms || this.floorData.rooms.length === 0) {
      // Show message if no rooms
      const isDark = this.isDarkTheme();
      ctx.fillStyle = isDark ? '#999' : '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'No rooms configured for this floor',
        canvasWidth / 2,
        canvasHeight / 2
      );
      return;
    }

    // Calculate bounds to fit all rooms
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.floorData.rooms.forEach((room: any) => {
      room.boundaries.forEach(([x, y]: [number, number]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    // Add padding
    const padding = 20;
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    
    // Adjust scale to account for rotation - calculate the bounding box after rotation
    const rotation = this.config?.rotation || 0;
    const rotRad = (rotation * Math.PI) / 180;
    const cosRot = Math.abs(Math.cos(rotRad));
    const sinRot = Math.abs(Math.sin(rotRad));
    
    // Rotated bounding box dimensions
    const rotatedWidth = dataWidth * cosRot + dataHeight * sinRot;
    const rotatedHeight = dataWidth * sinRot + dataHeight * cosRot;
    
    const scale = Math.min(
      (canvasWidth - 2 * padding) / rotatedWidth,
      (canvasHeight - 2 * padding) / rotatedHeight
    );

    // Calculate scaled dimensions
    const scaledWidth = dataWidth * scale;
    const scaledHeight = dataHeight * scale;
    
    // Center the content on canvas
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;

    // Transform coordinates to canvas space (centered)
    const transform = (x: number, y: number): [number, number] => [
      (x - minX) * scale + offsetX,
      (y - minY) * scale + offsetY
    ];

    // Draw each room with theme-appropriate colors
    const isDark = this.isDarkTheme();
    const colors = isDark 
      ? ['#1e3a5f', '#3d2a4d', '#2d4a2e', '#4d3d2a', '#4d2a3d'] // Dark theme colors
      : ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec']; // Light theme colors
    
    this.floorData.rooms.forEach((room: any, index: number) => {
      const boundaries = room.boundaries;
      if (!boundaries || boundaries.length === 0) return;

      // Draw room polygon
      ctx.beginPath();
      const [startX, startY] = transform(boundaries[0][0], boundaries[0][1]);
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i < boundaries.length; i++) {
        const [x, y] = transform(boundaries[i][0], boundaries[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Fill room
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      // Draw room border (walls are 0.1m thick in real space)
      ctx.strokeStyle = isDark ? '#555' : '#999';
      ctx.lineWidth = 0.1 * scale;
      ctx.stroke();

      // Calculate center and approximate width of room
      let centerX = 0, centerY = 0;
      let minRoomX = Infinity, maxRoomX = -Infinity;
      boundaries.forEach(([x, y]: [number, number]) => {
        const [tx, ty] = transform(x, y);
        centerX += tx;
        centerY += ty;
        minRoomX = Math.min(minRoomX, tx);
        maxRoomX = Math.max(maxRoomX, tx);
      });
      centerX /= boundaries.length;
      centerY /= boundaries.length;
      const roomWidth = maxRoomX - minRoomX;

      // Draw room label with wrapping (counter-rotate to keep text upright)
      const rotation = this.config?.rotation || 0;
      ctx.fillStyle = isDark ? '#999' : '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate if text needs wrapping (with 10px padding on each side)
      const maxWidth = roomWidth - 20;
      const textWidth = ctx.measureText(room.name).width;
      
      if (rotation !== 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((-rotation * Math.PI) / 180);
        
        if (textWidth > maxWidth && room.name.includes(' ')) {
          // Wrap text if it doesn't fit and has spaces
          const words = room.name.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          // Draw multiple lines
          const lineHeight = 16;
          const startY = -(lines.length - 1) * lineHeight / 2;
          lines.forEach((line, i) => {
            ctx.fillText(line, 0, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(room.name, 0, 0);
        }
        ctx.restore();
      } else {
        if (textWidth > maxWidth && room.name.includes(' ')) {
          // Wrap text if it doesn't fit and has spaces
          const words = room.name.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          // Draw multiple lines
          const lineHeight = 16;
          const startY = centerY - (lines.length - 1) * lineHeight / 2;
          lines.forEach((line, i) => {
            ctx.fillText(line, centerX, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(room.name, centerX, centerY);
        }
      }
    });

    // Draw beacon nodes after rooms
    this.drawBeaconNodes(ctx, minX, minY, scale, offsetX, offsetY, transform);
  }

  private drawBeaconNodes(
    ctx: CanvasRenderingContext2D,
    minX: number,
    minY: number,
    scale: number,
    offsetX: number,
    offsetY: number,
    transform: (x: number, y: number) => [number, number]
  ): void {
    if (!this.floorData?.beacon_nodes) return;

    const rotation = this.config?.rotation || 0;
    const floorCeilingHeight = this.floorData.floor_height;
    const floorMinHeight = this.floorData.floor_min_height;
    
    // Filter beacons to only show those on this floor
    // Floor height represents the ceiling height of this floor
    // Floor min height is the ceiling of the floor below (or 0 for ground floor)
    // For example: ground floor (min=0, height=2.4) shows beacons from 0m to 2.4m
    //              first floor (min=2.4, height=5.2) shows beacons from 2.4m to 5.2m
    const beaconEntries = Object.entries(this.floorData.beacon_nodes).filter(
      ([_, data]) => {
        // Support both old format (array) and new format (object)
        const coords = Array.isArray(data) ? data : data.coordinates;
        const [x, y, z] = coords;
        // Show beacons if Z is >= floor minimum and < floor ceiling
        return z >= floorMinHeight && z < floorCeilingHeight;
      }
    );
    
    const isDark = this.isDarkTheme();
    
    beaconEntries.forEach(([mac, data]) => {
      // Support both old format (array) and new format (object)
      const coords = Array.isArray(data) ? data : data.coordinates;
      const friendlyName = Array.isArray(data) ? undefined : data.name;
      const [x, y, z] = coords;
      const [canvasX, canvasY] = transform(x, y);

      // Draw beacon node as a circle with border
      const radius = 6;
      
      // Draw outer circle (border) - theme-appropriate colors
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#66BB6A' : '#4CAF50'; // Lighter green in dark mode
      ctx.fill();
      ctx.strokeStyle = isDark ? '#43A047' : '#2E7D32'; // Lighter border in dark mode
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw inner dot
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius / 3, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#1a1a1a' : '#fff';
      ctx.fill();

      // Only draw label if this beacon is hovered
      if (this.hoveredBeacon === mac) {
        // Draw label (friendly name if available, otherwise MAC address - last 4 characters)
        const label = friendlyName || mac.slice(-5).replace(':', '');
        const labelOffset = radius + 12;
        const labelColor = isDark ? '#66BB6A' : '#2E7D32';
        
        ctx.fillStyle = labelColor;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Check if label would hang off canvas and wrap if needed
        const labelWidth = ctx.measureText(label).width;
        const halfLabelWidth = labelWidth / 2;
        
        if (rotation !== 0) {
        ctx.save();
        ctx.translate(canvasX, canvasY + labelOffset);
        ctx.rotate((-rotation * Math.PI) / 180);
        
        // Check if wrapping is needed (label contains space and would overflow)
        if (label.includes(' ') && (canvasX - halfLabelWidth < 0 || canvasX + halfLabelWidth > canvasWidth)) {
          // Wrap text - split into lines
          const words = label.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > labelWidth * 0.7) { // Wrap at 70% of original width
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          // Draw multiple lines
          const lineHeight = 12;
          const startY = 0;
          lines.forEach((line, i) => {
            ctx.fillText(line, 0, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(label, 0, 0);
        }
        ctx.restore();
      } else {
        // Check if wrapping is needed (label contains space and would overflow)
        if (label.includes(' ') && (canvasX - halfLabelWidth < 0 || canvasX + halfLabelWidth > canvasWidth)) {
          // Wrap text - split into lines
          const words = label.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > labelWidth * 0.7) { // Wrap at 70% of original width
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          // Draw multiple lines
          const lineHeight = 12;
          const startY = canvasY + labelOffset;
          lines.forEach((line, i) => {
            ctx.fillText(line, canvasX, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(label, canvasX, canvasY + labelOffset);
        }
      }
      } // End hover check
    });

    // Draw moving entities after beacons
    this.drawMovingEntities(ctx, minX, minY, scale, offsetX, offsetY, transform);
  }

  private drawMovingEntities(
    ctx: CanvasRenderingContext2D,
    minX: number,
    minY: number,
    scale: number,
    offsetX: number,
    offsetY: number,
    transform: (x: number, y: number) => [number, number]
  ): void {
    if (!this.floorData?.moving_entities) return;

    const rotation = this.config?.rotation || 0;
    const floorCeilingHeight = this.floorData.floor_height;
    const floorMinHeight = this.floorData.floor_min_height;
    
    // Filter moving entities to only show those on this floor
    const movingEntries = Object.entries(this.floorData.moving_entities).filter(
      ([_, data]) => {
        const coords = data.coordinates;
        if (!coords || coords.length !== 3) return false;
        const [x, y, z] = coords;
        return z >= floorMinHeight && z < floorCeilingHeight;
      }
    );
    
    const isDark = this.isDarkTheme();
    
    movingEntries.forEach(([entityId, data]) => {
      const coords = data.coordinates;
      const [x, y, z] = coords;
      const [canvasX, canvasY] = transform(x, y);

      // Get friendly name from Home Assistant state
      const state = this.hass?.states[entityId];
      const friendlyName = state?.attributes?.friendly_name || entityId;

      // Draw moving entity as a larger circle - blue/purple theme
      const radius = 8;
      
      // Draw outer circle - blue in light, purple in dark
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#9C27B0' : '#2196F3'; // Purple in dark, blue in light
      ctx.fill();
      ctx.strokeStyle = isDark ? '#7B1FA2' : '#1976D2'; // Darker borders
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw inner dot
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius / 3, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#1a1a1a' : '#fff';
      ctx.fill();

      // Draw label (always visible for moving entities)
      const labelOffset = radius + 12;
      const labelColor = isDark ? '#9C27B0' : '#1976D2';
      
      ctx.fillStyle = labelColor;
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelWidth = ctx.measureText(friendlyName).width;
      const halfLabelWidth = labelWidth / 2;
      const canvas = ctx.canvas;
      const canvasWidth = canvas.width;

      // Handle rotation for labels
      if (rotation !== 0) {
        ctx.save();
        ctx.translate(canvasX, canvasY + labelOffset);
        ctx.rotate((-rotation * Math.PI) / 180);
        
        // Check if wrapping is needed
        if (friendlyName.includes(' ') && (canvasX - halfLabelWidth < 0 || canvasX + halfLabelWidth > canvasWidth)) {
          const words = friendlyName.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > labelWidth * 0.7) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          const lineHeight = 12;
          const startY = 0;
          lines.forEach((line, i) => {
            ctx.fillText(line, 0, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(friendlyName, 0, 0);
        }
        ctx.restore();
      } else {
        // Check if wrapping is needed
        if (friendlyName.includes(' ') && (canvasX - halfLabelWidth < 0 || canvasX + halfLabelWidth > canvasWidth)) {
          const words = friendlyName.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > labelWidth * 0.7) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          const lineHeight = 12;
          const startY = canvasY + labelOffset;
          lines.forEach((line, i) => {
            ctx.fillText(line, canvasX, startY + i * lineHeight);
          });
        } else {
          ctx.fillText(friendlyName, canvasX, canvasY + labelOffset);
        }
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'floorplan-card': FloorplanCard;
  }
}
