/**
 * Type definitions for Home Assistant Lovelace
 * These are a minimal subset of what's available
 */

declare module 'custom-card-helpers' {
  interface LovelaceCardConfig {
    type: string;
    [key: string]: any;
  }

  interface HomeAssistant {
    callService(
      domain: string,
      service: string,
      serviceData?: Record<string, any>,
      options?: { return_response?: boolean }
    ): Promise<any>;

    callWS(data: {
      type: string;
      domain?: string;
      service?: string;
      service_data?: Record<string, any>;
      return_response?: boolean;
      [key: string]: any;
    }): Promise<any>;

    states: {
      get(entityId: string): any;
    };

    config: {
      config_dir: string;
    };
  }
}
