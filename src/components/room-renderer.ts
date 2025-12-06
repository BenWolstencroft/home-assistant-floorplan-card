import { RendererConfig, Room } from '../types';

/**
 * Renders room boundaries on a 2D canvas
 */
export class RoomRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RendererConfig;
  private bounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(
    ctx: CanvasRenderingContext2D,
    config: RendererConfig,
    rooms: Room[]
  ) {
    this.ctx = ctx;
    this.config = config;
    this.bounds = this.calculateBounds(rooms);
  }

  /**
   * Render all rooms
   */
  public render(rooms: Room[]): void {
    this.clearCanvas();
    this.drawGrid();
    
    rooms.forEach((room) => {
      this.drawRoom(room);
    });
  }

  /**
   * Draw a single room
   */
  private drawRoom(room: Room): void {
    if (!room.boundaries || room.boundaries.length < 3) {
      console.warn(`Room ${room.id} has invalid boundaries`);
      return;
    }

    const path = new Path2D();
    const points = room.boundaries.map((p) =>
      this.worldToCanvas(p[0], p[1])
    );

    // Move to first point
    path.moveTo(points[0][0], points[0][1]);

    // Draw lines to all other points
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0], points[i][1]);
    }

    // Close the path
    path.closePath();

    // Fill room
    this.ctx.fillStyle = this.getRoomColor(room);
    this.ctx.fill(path);

    // Draw border
    this.ctx.strokeStyle = '#666';
    this.ctx.lineWidth = 2;
    this.ctx.stroke(path);

    // Draw label
    this.drawRoomLabel(room, points);
  }

  /**
   * Draw room name label
   */
  private drawRoomLabel(room: Room, points: [number, number][]): void {
    // Calculate center of room
    const centerX =
      points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const centerY =
      points.reduce((sum, p) => sum + p[1], 0) / points.length;

    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(room.name, centerX, centerY);
  }

  /**
   * Convert world coordinates to canvas coordinates
   */
  private worldToCanvas(x: number, y: number): [number, number] {
    const scale = this.config.scale;
    const padding = this.config.padding;

    const canvasX = (x - this.bounds.minX) * scale + padding;
    const canvasY = (y - this.bounds.minY) * scale + padding;

    return [canvasX, canvasY];
  }

  /**
   * Calculate bounding box for all rooms
   */
  private calculateBounds(rooms: Room[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    rooms.forEach((room) => {
      room.boundaries.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
    });

    return { minX, maxX, minY, maxY };
  }

  /**
   * Clear the canvas
   */
  private clearCanvas(): void {
    this.ctx.fillStyle = '#fafafa';
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);
  }

  /**
   * Draw reference grid
   */
  private drawGrid(): void {
    const gridSize = 10; // pixels between grid lines
    const padding = this.config.padding;

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = padding; x < this.config.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.config.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = padding; y < this.config.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.config.width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Get color for room type
   */
  private getRoomColor(room: Room): string {
    const colors: Record<string, string> = {
      living_room: '#e0e0e0',
      kitchen: '#fff9c4',
      bedroom: '#f8bbd0',
      bathroom: '#b3e5fc',
      hallway: '#f5f5f5',
      storage: '#dcedc8',
      office: '#ffe0b2',
      garage: '#d7ccc8',
    };

    // Try to match by room name
    const name = room.name.toLowerCase();
    for (const [type, color] of Object.entries(colors)) {
      if (name.includes(type)) {
        return color;
      }
    }

    return '#e0e0e0'; // Default gray
  }
}
