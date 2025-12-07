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
}

interface CardFloorplanData {
  rooms: Room[];
  entity_coordinates: Record<string, [number, number, number]>;
  beacon_nodes: Record<string, [number, number, number]>;
}

@customElement('floorplan-card')
export class FloorplanCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ type: Object }) public config?: FloorplanCardConfig;
  @state() private floorData?: CardFloorplanData;
  @state() private loading = false;
  @state() private error?: string;

  static getStubConfig(): FloorplanCardConfig {
    return {
      type: 'custom:floorplan-card',
      title: 'Floorplan',
      floor_id: 'ground_floor',
      service_domain: 'floorplan',
      full_width: false,
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
        aspect-ratio: 16 / 10;
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
      const roomsResponse = await this.hass.callService(
        this.config.service_domain || 'floorplan',
        'get_rooms_by_floor',
        {
          floor_id: this.config.floor_id || 'ground_floor'
        }
      );

      // Fetch entity coordinates
      const coordsResponse = await this.hass.callService(
        this.config.service_domain || 'floorplan',
        'get_all_entity_coordinates',
        {}
      );

      // Combine the data
      this.floorData = {
        rooms: roomsResponse.rooms || [],
        entity_coordinates: coordsResponse.entity_coordinates || {},
        beacon_nodes: coordsResponse.beacon_nodes || {}
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

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render rooms from integration data
    this.drawRoomsFromData(ctx, canvas.width, canvas.height);
  }

  private drawRoomsFromData(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.floorData?.rooms || this.floorData.rooms.length === 0) {
      // Show message if no rooms
      ctx.fillStyle = '#999';
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
    const scale = Math.min(
      (canvasWidth - 2 * padding) / dataWidth,
      (canvasHeight - 2 * padding) / dataHeight
    );

    // Transform coordinates to canvas space
    const transform = (x: number, y: number): [number, number] => [
      (x - minX) * scale + padding,
      (y - minY) * scale + padding
    ];

    // Draw each room
    const colors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec'];
    
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

      // Draw room border
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Calculate center for label
      let centerX = 0, centerY = 0;
      boundaries.forEach(([x, y]: [number, number]) => {
        const [tx, ty] = transform(x, y);
        centerX += tx;
        centerY += ty;
      });
      centerX /= boundaries.length;
      centerY /= boundaries.length;

      // Draw room label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, centerX, centerY);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'floorplan-card': FloorplanCard;
  }
}
