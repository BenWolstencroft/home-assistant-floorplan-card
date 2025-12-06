import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { RoomRenderer } from './components/room-renderer';
import { FloorplanConfig } from './types';

interface FloorplanCardConfig extends LovelaceCardConfig {
  title?: string;
  floor_id?: string;
  service_domain?: string;
}

@customElement('floorplan-card')
export class FloorplanCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ type: Object }) public config?: FloorplanCardConfig;
  @state() private floorData?: FloorplanConfig;
  @state() private loading = false;
  @state() private error?: string;

  static getStubConfig(): FloorplanCardConfig {
    return {
      type: 'custom:floorplan-card',
      title: 'Floorplan',
      floor_id: 'ground_floor',
      service_domain: 'floorplan',
    };
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .title {
        font-size: 20px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .floor-selector {
        display: flex;
        gap: 8px;
      }

      select {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--ha-card-background);
        color: var(--primary-text-color);
        cursor: pointer;
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

  private async loadFloorplanData(): Promise<void> {
    if (!this.hass || !this.config) return;

    this.loading = true;
    this.error = undefined;

    try {
      const response = await this.hass.callService(
        this.config.service_domain || 'floorplan',
        'get_all_entity_coordinates',
        {}
      );

      // For now, we just store the response
      // In a real implementation, we'd parse the floorplan structure
      this.floorData = response;
    } catch (err) {
      this.error = `Failed to load floorplan data: ${err}`;
      console.error('Floorplan card error:', err);
    } finally {
      this.loading = false;
    }
  }

  protected render(): TemplateResult {
    if (!this.hass || !this.config) {
      return html`<div class="error">Card not configured</div>`;
    }

    if (this.loading) {
      return html`<div class="loading">Loading floorplan...</div>`;
    }

    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    return html`
      <div class="card">
        <div class="header">
          <div class="title">${this.config.title || 'Floorplan'}</div>
          <div class="floor-selector">
            <select @change="${this.onFloorChange}">
              <option value="ground_floor">Ground Floor</option>
              <option value="1st_floor">1st Floor</option>
              <option value="basement">Basement</option>
            </select>
          </div>
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

  private onFloorChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const floorId = select.value;
    // TODO: Update floor view
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
    ctx.fillStyle = 'var(--surface-variant)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render rooms (placeholder for now)
    this.drawSampleRooms(ctx, canvas.width, canvas.height);
  }

  private drawSampleRooms(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Sample rooms for demonstration
    const rooms = [
      { name: 'Living Room', x: 50, y: 50, w: 150, h: 120, color: '#e0e0e0' },
      { name: 'Kitchen', x: 210, y: 50, w: 120, h: 120, color: '#f5f5f5' },
      { name: 'Bedroom', x: 50, y: 190, w: 140, h: 100, color: '#fffde7' },
      { name: 'Bathroom', x: 210, y: 190, w: 80, h: 100, color: '#e1f5fe' },
    ];

    rooms.forEach((room) => {
      // Draw room background
      ctx.fillStyle = room.color;
      ctx.fillRect(room.x, room.y, room.w, room.h);

      // Draw room border
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      // Draw room label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        room.name,
        room.x + room.w / 2,
        room.y + room.h / 2
      );
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'floorplan-card': FloorplanCard;
  }
}
