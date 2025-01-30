// serial.ts
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventEmitter } from 'events';
import { ipcMain } from 'electron';



export class SerialHandler {
    private serialService: SerialService;

    constructor() {
        this.serialService = new SerialService();
        this.setupIpcHandlers();
        this.setupSerialEvents();
    }

    private setupIpcHandlers() {
        // Handle requests from renderer
        ipcMain.handle('connect-port', async (_, portName: string) => {
            try {
                await this.serialService.connectToSerialPort(portName);
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });
    }

    private setupSerialEvents() {
        this.serialService.on('diameterChange', (command) => {
            this.sendToRenderer('diameterChange', command);
        });
    }

    private sendToRenderer(channel: string, data: any) {
        // Send to all windows
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach((window: { webContents: { send: (arg0: string, arg1: any) => void; }; }) => {
            window.webContents.send(channel, data);
        });
    }
}

interface SerialPortInfo {
    path: string;
    vendorId?: string;
    productId?: string;
}

interface SerialEvents {
    diameterChange: (command: number) => void;
}

// Extend EventEmitter with our custom events
declare interface SerialService {
    on<K extends keyof SerialEvents>(event: K, listener: SerialEvents[K]): this;
    emit<K extends keyof SerialEvents>(event: K, ...args: Parameters<SerialEvents[K]>): boolean;
}

class SerialService extends EventEmitter {
    private serialPort: SerialPort | null;
    private portDataIsSet: boolean;
    private parser: ReadlineParser | null;

    constructor() {
        super();
        this.serialPort = null;
        this.parser = null;
        this.portDataIsSet = false;
        
        // Initialize by finding and connecting to Arduino Leonardo
        this.initializeArduino();
    }

    private async initializeArduino(): Promise<void> {
        try {
            const arduinoPort = await this.findArduinoLeonardo();
            if (arduinoPort) {
                console.log('Found Arduino Leonardo at:', arduinoPort);
                await this.connectToSerialPort(arduinoPort);
            } else {
                console.log('Arduino Leonardo not found');
            }
        } catch (error) {
            console.error('Error initializing Arduino:', error);
        }
    }

    private async findArduinoLeonardo(): Promise<string | null> {
        try {
            const ports = await SerialPort.list();
            const leonardo = ports.find((port: SerialPortInfo) => 
                port.vendorId === '2341' && port.productId === '8036'
            );
            return leonardo ? leonardo.path : null;
        } catch (error) {
            console.error('Error listing ports:', error);
            return null;
        }
    }

    private setPort(portName: string): void {
        try {
            this.serialPort = new SerialPort({
                path: portName,
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                rtscts: true
            });
            
            this.portDataIsSet = true;

            // Set up parser to handle incoming data
            this.parser = new ReadlineParser({ delimiter: '\r\n' });
            this.serialPort.pipe(this.parser);
            this.parser.on('data', (data: string) => this.handleSerialData(data));

            // Handle errors
            this.serialPort.on('error', (err: Error) => {
                console.error('Serial port error:', err);
            });
        } catch (error) {
            console.error('Error setting up serial port:', error);
            throw error;
        }
    }

    public async connectToSerialPort(portName: string): Promise<void> {
        this.setPort(portName);
    }

    private parseData(binaryString: string): number { 
        var dec = "" 
        getDec(32);
        dec += "."
        getDec(36);
        getDec(40);
        return parseFloat(dec)

        function getDec(index: number) {
            let binaryByte = binaryString.substring(index, index + 4).split("").reverse().join("")
            dec += parseInt(binaryByte, 2);  
        }
    }



    private handleSerialData(dataIn: string): void {

        console.log(this.parseData(dataIn))

        this.emit('diameterChange', this.parseData(dataIn));
    }
}

export default SerialService;