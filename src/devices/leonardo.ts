// devices/leonardo.ts
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { Device, DeviceInfo } from '../device';

interface SerialPortInfo {
    path: string;
    vendorId?: string;
    productId?: string;
}

/**
 * Arduino Leonardo device for diameter measurement.
 * Communicates via serial port at 115200 baud.
 * Outputs diameter in millimeters (mm).
 */
export class Leonardo extends Device {
    private serialPort: SerialPort | null = null;
    private parser: ReadlineParser | null = null;
    private boundHandleData: (data: string) => void;

    readonly deviceInfo: DeviceInfo = {
        name: 'Arduino Leonardo',
        vendorId: '2341',
        productId: '8036'
    };

    constructor() {
        super();
        this.boundHandleData = this.handleData.bind(this);
    }

    /**
     * Find Arduino Leonardo device
     */
    async find(): Promise<boolean> {
        try {
            const ports = await SerialPort.list();
            const leonardo = ports.find((port: SerialPortInfo) =>
                port.vendorId === this.deviceInfo.vendorId &&
                port.productId === this.deviceInfo.productId
            );
            return leonardo !== undefined;
        } catch (error) {
            console.error('Error listing ports:', error);
            return false;
        }
    }

    /**
     * Get the port path for the Leonardo device
     */
    private async getPortPath(): Promise<string | null> {
        try {
            const ports = await SerialPort.list();
            const leonardo = ports.find((port: SerialPortInfo) =>
                port.vendorId === this.deviceInfo.vendorId &&
                port.productId === this.deviceInfo.productId
            );
            return leonardo ? leonardo.path : null;
        } catch (error) {
            console.error('Error listing ports:', error);
            return null;
        }
    }

    /**
     * Connect to the Arduino Leonardo
     */
    async connect(): Promise<void> {
        const portPath = await this.getPortPath();
        if (!portPath) {
            throw new Error('Arduino Leonardo not found');
        }

        try {
            console.log('Opening serial port:', portPath);
            this.serialPort = new SerialPort({
                path: portPath,
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                rtscts: true
            });

            // Set up parser to handle incoming data
            this.parser = new ReadlineParser({ delimiter: '\r\n' });
            this.serialPort.pipe(this.parser);

            this.isConnected = true;
            this.emit('connected');
            console.log('Serial port opened successfully');
        } catch (error) {
            console.error('Error setting up serial port:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the Arduino Leonardo
     */
    async disconnect(): Promise<void> {
        this.stopReading();
        
        if (this.serialPort && this.serialPort.isOpen) {
            return new Promise((resolve, reject) => {
                this.serialPort!.close((err) => {
                    if (err) {
                        console.error('Error closing serial port:', err);
                        reject(err);
                    } else {
                        this.serialPort = null;
                        this.parser = null;
                        this.isConnected = false;
                        this.emit('disconnected');
                        resolve();
                    }
                });
            });
        }
        
        this.serialPort = null;
        this.parser = null;
        this.isConnected = false;
    }

    /**
     * Start reading diameter data
     */
    startReading(): void {
        if (!this.parser) {
            console.error('Cannot start reading: not connected');
            return;
        }
        
        this.parser.on('data', this.boundHandleData);
        this.isReading = true;
    }

    /**
     * Stop reading diameter data
     */
    stopReading(): void {
        if (this.parser) {
            this.parser.removeListener('data', this.boundHandleData);
        }
        this.isReading = false;
    }

    /**
     * Parse binary data from the Leonardo device
     * @param binaryString - Binary string from the device
     * @returns Diameter in millimeters (mm)
     */
    private parseData(binaryString: string): number {
        let dec = "";

        const getDec = (index: number) => {
            const binaryByte = binaryString.substring(index, index + 4).split("").reverse().join("");
            dec += parseInt(binaryByte, 2);
        };

        getDec(32);
        dec += ".";
        getDec(36);
        getDec(40);

        return parseFloat(dec);
    }

    /**
     * Handle incoming serial data
     */
    private handleData(dataIn: string): void {
        try {
            const diameter = this.parseData(dataIn);
            this.emit('diameter', diameter);
        } catch (error) {
            console.error('Error parsing Leonardo data:', error);
            this.emit('error', error as Error);
        }
    }
}

export default Leonardo;

