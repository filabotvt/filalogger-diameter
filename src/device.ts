// device.ts
import { EventEmitter } from 'events';

/**
 * Events emitted by Device implementations
 */
export interface DeviceEvents {
    diameter: (diameter: number) => void;
    connected: () => void;
    disconnected: () => void;
    error: (error: Error) => void;
}

/**
 * Device identification info
 */
export interface DeviceInfo {
    name: string;
    vendorId: string;
    productId: string;
}

/**
 * Abstract base class for diameter measurement devices.
 * All diameter values are in millimeters (mm).
 */
export abstract class Device extends EventEmitter {
    protected isConnected: boolean = false;
    protected isReading: boolean = false;

    /**
     * Device identification info
     */
    abstract readonly deviceInfo: DeviceInfo;

    /**
     * Check if this device is available/connected to the system
     * @returns Promise<boolean> true if device is found
     */
    abstract find(): Promise<boolean>;

    /**
     * Connect to the device
     * @throws Error if connection fails
     */
    abstract connect(): Promise<void>;

    /**
     * Disconnect from the device
     */
    abstract disconnect(): Promise<void>;

    /**
     * Start reading diameter measurements from the device
     * Diameter values are emitted via the 'diameter' event in millimeters
     */
    abstract startReading(): void;

    /**
     * Stop reading diameter measurements
     */
    abstract stopReading(): void;

    /**
     * Get current connection status
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get current reading status
     */
    get reading(): boolean {
        return this.isReading;
    }

    // Type-safe event emitter methods
    on<K extends keyof DeviceEvents>(event: K, listener: DeviceEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof DeviceEvents>(event: K, ...args: Parameters<DeviceEvents[K]>): boolean {
        return super.emit(event, ...args);
    }

    removeListener<K extends keyof DeviceEvents>(event: K, listener: DeviceEvents[K]): this {
        return super.removeListener(event, listener);
    }
}

export default Device;

