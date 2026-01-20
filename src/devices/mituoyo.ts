// devices/mituoyo.ts
import { Device, DeviceInfo } from '../device';

// USB library types
interface USBDevice {
    open(): void;
    close(): void;
    setConfiguration(config: number, callback: (err?: Error) => void): void;
    interface(num: number): USBInterface;
    controlTransfer(
        bmRequestType: number,
        bRequest: number,
        wValue: number,
        wIndex: number,
        dataOrLength: Buffer | number,
        callback: (err?: Error, data?: Buffer) => void
    ): void;
}

interface USBInterface {
    endpoints: USBEndpoint[];
    isKernelDriverActive(): boolean;
    detachKernelDriver(): void;
    claim(): void;
    release(callback?: (err?: Error) => void): void;
}

interface USBEndpoint {
    direction: 'in' | 'out';
    transfer(length: number, callback: (err?: Error, data?: Buffer) => void): void;
}

const MAX_PKT = 64;

/**
 * Mitutoyo USB measurement device.
 * Communicates via USB HID protocol.
 * Outputs diameter in millimeters (mm) - automatically converts from inches if needed.
 */
export class Mituoyo extends Device {
    private device: USBDevice | null = null;
    private iface: USBInterface | null = null;
    private epin: USBEndpoint | null = null;
    private readingLoop: boolean = false;
    private usb: any = null;

    readonly deviceInfo: DeviceInfo = {
        name: 'Mitutoyo USB',
        vendorId: '0fe7',
        productId: '4001'
    };

    constructor() {
        super();
    }

    /**
     * Load the USB library dynamically
     */
    private loadUSB(): any {
        if (!this.usb) {
            this.usb = require('usb');
        }
        return this.usb;
    }

    /**
     * Detect whether measurement is in inches or mm based on format:
     * - Inches: 01A+000.0000 (3 digits before decimal, 4 after)
     * - MM: 01A+00000.00 (5 digits before decimal, 2 after)
     */
    private detectUnit(decoded: string): 'inches' | 'mm' | 'unknown' {
        const dotPos = decoded.indexOf('.');
        if (dotPos === -1) {
            return 'unknown';
        }

        let signPos = decoded.indexOf('+');
        if (signPos === -1) {
            signPos = decoded.indexOf('-');
        }
        if (signPos === -1) {
            return 'unknown';
        }

        const digitsBeforeDecimal = dotPos - signPos - 1;

        if (digitsBeforeDecimal === 3) {
            return 'inches';
        } else if (digitsBeforeDecimal === 5) {
            return 'mm';
        } else {
            return 'unknown';
        }
    }

    /**
     * Promisify control transfer
     */
    private controlTransfer(
        bmRequestType: number,
        bRequest: number,
        wValue: number,
        wIndex: number,
        dataOrLength: Buffer | number
    ): Promise<Buffer | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.device) {
                reject(new Error('Device not connected'));
                return;
            }
            this.device.controlTransfer(bmRequestType, bRequest, wValue, wIndex, dataOrLength, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    /**
     * Promisify endpoint transfer
     */
    private endpointTransfer(length: number): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            if (!this.epin) {
                reject(new Error('Endpoint not available'));
                return;
            }
            this.epin.transfer(length, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data!);
                }
            });
        });
    }

    /**
     * Find Mitutoyo device
     */
    async find(): Promise<boolean> {
        try {
            const usb = this.loadUSB();
            const vendorId = parseInt(this.deviceInfo.vendorId, 16);
            const productId = parseInt(this.deviceInfo.productId, 16);
            const device = usb.findByIds(vendorId, productId);
            return device !== undefined;
        } catch (error) {
            console.error('Error finding Mitutoyo device:', error);
            return false;
        }
    }

    /**
     * Connect to the Mitutoyo device
     */
    async connect(): Promise<void> {
        try {
            const usb = this.loadUSB();
            const vendorId = parseInt(this.deviceInfo.vendorId, 16);
            const productId = parseInt(this.deviceInfo.productId, 16);
            
            this.device = usb.findByIds(vendorId, productId);

            if (!this.device) {
                throw new Error('Mitutoyo device not found');
            }

            this.device.open();

            // Set configuration (may fail on Windows if already configured)
            try {
                await new Promise<void>((resolve, reject) => {
                    this.device!.setConfiguration(1, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            } catch (e: any) {
                console.log(`Note: setConfiguration returned: ${e.message} (continuing anyway)`);
            }

            // Claim interface
            this.iface = this.device.interface(0);
            try {
                if (this.iface.isKernelDriverActive()) {
                    this.iface.detachKernelDriver();
                }
            } catch (e) {
                // Ignore - not supported on Windows
            }
            this.iface.claim();

            // Get endpoint
            const endpoints = this.iface.endpoints;
            this.epin = endpoints.find((ep: USBEndpoint) => ep.direction === 'in') || null;

            if (!this.epin) {
                throw new Error('Could not find input endpoint');
            }

            // Initial setup commands
            try {
                await this.controlTransfer(0x40, 0x01, 0xA5A5, 0, Buffer.alloc(0));
            } catch (e: any) {
                console.error(`Error in setup command 1: ${e.message}`);
            }

            try {
                await this.controlTransfer(0xC0, 0x02, 0, 0, 1);
            } catch (e: any) {
                console.error(`Error in setup command 2: ${e.message}`);
            }

            // Small delay after setup
            await new Promise(resolve => setTimeout(resolve, 100));

            this.isConnected = true;
            this.emit('connected');
            console.log('Mitutoyo device connected');
        } catch (error) {
            console.error('Error connecting to Mitutoyo:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the Mitutoyo device
     */
    async disconnect(): Promise<void> {
        this.stopReading();

        try {
            if (this.iface) {
                await new Promise<void>((resolve) => {
                    this.iface!.release(() => resolve());
                });
            }
        } catch (e) {
            // Ignore errors during cleanup
        }

        try {
            if (this.device) {
                this.device.close();
            }
        } catch (e) {
            // Ignore errors during cleanup
        }

        this.device = null;
        this.iface = null;
        this.epin = null;
        this.isConnected = false;
        this.emit('disconnected');
        console.log('Mitutoyo device disconnected');
    }

    /**
     * Start reading diameter data
     */
    startReading(): void {
        if (!this.device || !this.epin) {
            console.error('Cannot start reading: not connected');
            return;
        }

        this.readingLoop = true;
        this.isReading = true;
        this.readLoop();
    }

    /**
     * Stop reading diameter data
     */
    stopReading(): void {
        this.readingLoop = false;
        this.isReading = false;
    }

    /**
     * Continuous reading loop
     */
    private async readLoop(): Promise<void> {
        while (this.readingLoop && this.isConnected) {
            try {
                // Send read command
                await this.controlTransfer(0x40, 0x03, 0, 0, Buffer.from("1\r", 'ascii'));

                // Small delay before reading
                await new Promise(resolve => setTimeout(resolve, 10));

                // Read measurement
                const data = await this.endpointTransfer(MAX_PKT);
                const decoded = data.toString('ascii').trim();

                // Parse and emit the diameter
                const diameter = this.parseData(decoded);
                this.emit('diameter', diameter);

                // Small delay to avoid overwhelming the device
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e: any) {
                if (this.readingLoop) {
                    console.error(`Error during reading: ${e.message}`);
                    this.emit('error', e);
                }
                // Small delay on error before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Parse measurement data from the Mitutoyo device
     * @param decoded - ASCII string from device (e.g., "01A+00001.75" or "01A+000.0689")
     * @returns Diameter in millimeters (mm)
     */
    private parseData(decoded: string): number {
        const unit = this.detectUnit(decoded);

        // Extract just the numeric value: skip "01A" prefix, keeps sign
        let value = parseFloat(decoded.substring(3));

        // Convert to mm if in inches (1 inch = 25.4 mm)
        if (unit === 'inches') {
            value = value * 25.4;
        }

        return value;
    }
}

export default Mituoyo;

