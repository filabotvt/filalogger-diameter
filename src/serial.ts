// serial.ts
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventEmitter } from 'events';
import { ipcMain, app, shell, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';



export class SerialHandler {
    private serialService: SerialService;

    constructor() {
        this.serialService = new SerialService();
        this.setupIpcHandlers();
        this.setupSerialEvents();
    }

    private setupIpcHandlers() {
        // Handle connection requests from renderer
        ipcMain.handle('connect-port', async (_, portName: string) => {
            try {
                await this.serialService.connectToSerialPort();
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        // Handle command requests from renderer
        ipcMain.handle('send-command', async (_, command: string) => {
            try {
                await this.serialService.sendCommand(command);
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('set-state', async (_, state: SerialState) => {
            try {
                await this.serialService.setState(state);
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('open-folder', async (_) => {
            try {
                await this.serialService.openFolder();
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('choose-folder', async (_) => {
            console.log("Choose folder");
            
            try {
                await this.serialService.chooseFolder();
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });
    }


    private setupSerialEvents() {
        this.serialService.on('diameterChange', (diameter) => {
            this.sendToRenderer('diameterChange', diameter);
        });

        this.serialService.on('stateChange', (state) => {
            this.sendToRenderer('stateChange', state);
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

export interface SerialState {
    connected: boolean;
    recording: boolean;
    description: string;
    max: number;
    min: number;
    spoolNumber: number;
    batchNumber: number;
    upperLimit: number;
    lowerLimit: number;
    target: number;
    saveLocation: string
}

interface CSV {
    writer: fs.WriteStream | null;  // Add CSV writer to state
    filePath: string | null;    // Track current CSV file path
}

interface SerialEvents {
    diameterChange: (command: number) => void;
    stateChange: (state: SerialState) => void;
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
    private state: SerialState;
    private csv: CSV
    private boundHandleSerialData: (data: string) => void; 
    private readonly CONFIG_FILE = 'settings.json';
    private configPath: string;
    private connectionInterval: NodeJS.Timeout | null = null;
    private isFolderViewerOpen = false

    constructor() {
        super();
        this.serialPort = null;
        this.parser = null;
        this.portDataIsSet = false;
        this.configPath = path.join(app.getPath('userData'), this.CONFIG_FILE);

        this.state = {
            connected: false,
            recording: false,
            description: "",
            max: 0,
            min: Infinity,
            spoolNumber: 0,
            batchNumber: 0,
            upperLimit: 1.8,
            lowerLimit: 1.6,
            target: 1.7,
            saveLocation: path.join(app.getPath('documents'), "filalogger")
        }
        this.csv = {
            writer: null,
            filePath: null
        }
        console.log(app.getPath('userData'))
        this.loadSettings();
        this.boundHandleSerialData = this.handleSerialData.bind(this);
        
    }

    public openFolder() {
        shell.openPath(this.state.saveLocation)
    }

    public async chooseFolder() {
        if(this.isFolderViewerOpen == true) {
            return
        }
        this.isFolderViewerOpen = true
        try {
        const result = await dialog.showOpenDialog({
            title: 'Select Save Location',
            defaultPath: this.state.saveLocation,
            buttonLabel: 'Select Folder',
            properties: ['openDirectory', 'createDirectory']
          })
          if(result.filePaths[0]) {
            console.log(`path ${result.filePaths}`)
            this.state.saveLocation = result.filePaths[0]
            this.saveSettings();
            this.emit('stateChange', this.state);
          }
        } finally {
            this.isFolderViewerOpen = false
        }
    }

    public async  connectToSerialPort() {
        await this.initializeArduino();

        this.emit('stateChange', this.state);
    }

    private loadSettings(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const savedSettings = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                console.log(savedSettings)
                this.state = {
                    ...this.state,
                    spoolNumber: savedSettings.spoolNumber ?? this.state.spoolNumber,
                    target: savedSettings.target ?? this.state.target,
                    upperLimit: savedSettings.upperLimit ?? this.state.upperLimit,
                    lowerLimit: savedSettings.lowerLimit ?? this.state.lowerLimit,
                    saveLocation: savedSettings.saveLocation ?? this.state.saveLocation,
                    description: savedSettings.description ?? this.state.description
                };
            } else {
                // If file doesn't exist, create it with default values
                this.saveSettings();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Continue with default values if there's an error
        }
    }

    private saveSettings(): void {
        try {
            const settings = {
                spoolNumber: this.state.spoolNumber,
                target: this.state.target,
                upperLimit: this.state.upperLimit,
                lowerLimit: this.state.lowerLimit,
                saveLocation: this.state.saveLocation,
                description: this.state.description
            };
            fs.writeFileSync(this.configPath, JSON.stringify(settings, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    private async initializeArduino(): Promise<void> {
        try {
            await this.checkAndConnect();
            // Start checking every second
            this.connectionInterval = setInterval(
                () => this.checkAndConnect(),
                1000
            );
        } catch (error) {
            console.error('Error initializing Arduino:', error);
        }
    }
    
    private async checkAndConnect(): Promise<void> {
        let previousConnectionState = this.state.connected
        try {
            const arduinoPort = await this.findArduinoLeonardo();
            if (arduinoPort) {
                if (!this.state.connected) {
                    console.log('Found Arduino Leonardo at:', arduinoPort);
                    await this.setPort(arduinoPort);
                    this.state.connected = true;
                }
            } else {
                if (this.state.connected) {
                    console.log('Arduino Leonardo disconnected');
                }
                this.state.connected = false;
                if(this.state.recording) {
                    this.sendCommand("stop")
                }
            }
        } catch (error) {
            console.error('Error checking Arduino:', error);
            this.state.connected = false;
        }
        if(previousConnectionState != this.state.connected) {
            this.emit('stateChange', this.state);
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
            console.log("Opening serial")
            this.serialPort = new SerialPort({
                path: portName,
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                rtscts: true
            });
            console.log("Opening serial success")
            this.portDataIsSet = true;

            // Set up parser to handle incoming data
            this.parser = new ReadlineParser({ delimiter: '\r\n' });
            this.serialPort.pipe(this.parser);
        } catch (error) {
            console.error('Error setting up serial port:', error);
            throw error;
        }
    }


    private createCsvFile(): void {
        // Create logs directory if it doesn't exist
        const logsDir = this.state.saveLocation
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }

        // Generate filename in mm-dd-yyyy___Spool<number> format
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        if(this.state.description && this.state.description.length > 0) {
            const filename = `${this.state.description}___${month}-${day}-${year}___Spool${this.state.spoolNumber}.csv`;
            this.csv.filePath = path.join(logsDir, filename);
        } else {
            const filename = `${month}-${day}-${year}___Spool${this.state.spoolNumber}.csv`;
            this.csv.filePath = path.join(logsDir, filename);
        }
        console.log(this.csv.filePath)
        // Create CSV file with headers
        this.csv.writer = fs.createWriteStream(this.csv.filePath);
        this.csv.writer.write('Timestamp,Diameter\n');
    }

    private writeToCSV(diameter: number): void {
        if (!this.csv.writer) return;

        // Calculate Excel timestamp (days since 1900)
        const now = new Date();
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch (December 30, 1899)
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        const excelTimestamp = (now.getTime() - excelEpoch.getTime()) / millisecondsPerDay;

        // Write data to CSV
        this.csv.writer.write(`${excelTimestamp},${diameter}\n`);
    }

    public async sendCommand(command: string): Promise<void> {
        if (!this.parser || !this.serialPort) {
            return;
        }
        
        if (command === "start") {
            this.state.spoolNumber++;
            this.saveSettings();
            this.createCsvFile(); // Create new CSV file
            this.parser.on('data', this.boundHandleSerialData);
            this.state = {
                ...this.state,
                recording: true,
                min: Infinity,
                max: 0
            };
            console.log(this.state.spoolNumber)
            this.emit('stateChange', this.state);
        } else if (command === "stop") {
            this.parser.removeListener('data', this.boundHandleSerialData);
            // Close CSV file if it's open
            if (this.csv.writer) {
                this.csv.writer.end();
                this.csv.writer = null;
                this.csv.filePath = null;
            }
            this.state = {
                ...this.state,
                recording: false
            };
            this.emit('stateChange', this.state);
        }
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
        const diameter = this.parseData(dataIn);
        if(diameter > this.state.max) {
            this.state.max = diameter
            this.emit('stateChange', this.state);
        }
        if(diameter < this.state.min) {
            this.state.min = diameter
            this.emit('stateChange', this.state);
        }
        this.writeToCSV(diameter); // Write to CSV
        this.emit('diameterChange', diameter);
    }

    setState(newState: SerialState): void {
        this.state = {
            ...this.state,
            upperLimit: newState.upperLimit,
            lowerLimit: newState.lowerLimit,
            spoolNumber: newState.spoolNumber,
            batchNumber: newState.batchNumber,
            target: newState.target,
            description: newState.description
        }
        this.saveSettings()
        this.emit('stateChange', this.state);
    }
    
}

export default SerialService;