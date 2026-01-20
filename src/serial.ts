// serial.ts
import { EventEmitter } from 'events';
import { ipcMain, app, shell, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Device, Leonardo, Mituoyo } from './devices';



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

// Available device types for auto-detection
const DEVICE_TYPES = [Leonardo, Mituoyo];

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
    private device: Device | null = null;
    private state: SerialState;
    private csv: CSV;
    private boundHandleDiameter: (diameter: number) => void;
    private readonly CONFIG_FILE = 'settings.json';
    private configPath: string;
    private connectionInterval: NodeJS.Timeout | null = null;
    private isFolderViewerOpen = false;

    constructor() {
        super();
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
        };
        this.csv = {
            writer: null,
            filePath: null
        };
        console.log(app.getPath('userData'));
        this.loadSettings();
        this.boundHandleDiameter = this.handleDiameter.bind(this);
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

    public async connectToSerialPort() {
        await this.initializeDevice();

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
                    batchNumber: savedSettings.batchNumber ?? this.state.batchNumber,
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
                batchNumber: this.state.batchNumber,
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

    private async initializeDevice(): Promise<void> {
        try {
            await this.checkAndConnect();
            // Start checking every second
            this.connectionInterval = setInterval(
                () => this.checkAndConnect(),
                1000
            );
        } catch (error) {
            console.error('Error initializing device:', error);
        }
    }

    /**
     * Find and connect to the first available device
     */
    private async findAvailableDevice(): Promise<Device | null> {
        for (const DeviceClass of DEVICE_TYPES) {
            const device = new DeviceClass();
            try {
                const found = await device.find();
                if (found) {
                    console.log(`Found device: ${device.deviceInfo.name}`);
                    return device;
                }
            } catch (error) {
                console.error(`Error checking ${device.deviceInfo.name}:`, error);
            }
        }
        return null;
    }

    private async checkAndConnect(): Promise<void> {
        let previousConnectionState = this.state.connected;
        try {
            const availableDevice = await this.findAvailableDevice();
            if (availableDevice) {
                if (!this.state.connected) {
                    console.log('Connecting to:', availableDevice.deviceInfo.name);
                    await availableDevice.connect();
                    this.device = availableDevice;
                    this.state.connected = true;
                }
            } else {
                if (this.state.connected) {
                    console.log('Device disconnected');
                    if (this.device) {
                        await this.device.disconnect();
                        this.device = null;
                    }
                }
                this.state.connected = false;
                if (this.state.recording) {
                    this.sendCommand("stop");
                }
            }
        } catch (error) {
            console.error('Error checking device:', error);
            this.state.connected = false;
        }
        if (previousConnectionState != this.state.connected) {
            this.emit('stateChange', this.state);
        }
    }


    private createCsvFile(): void {
        // Create logs directory if it doesn't exist
        const logsDir = this.state.saveLocation
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }

        // Generate filename in mm-dd-yyyy___Batch<number>___Spool<number> format
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        if(this.state.description && this.state.description.length > 0) {
            const filename = `${this.state.description}___${month}-${day}-${year}___Batch${this.state.batchNumber}___Spool${this.state.spoolNumber}.csv`;
            this.csv.filePath = path.join(logsDir, filename);
        } else {
            const filename = `${month}-${day}-${year}___Batch${this.state.batchNumber}___Spool${this.state.spoolNumber}.csv`;
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
        if (!this.device || !this.device.connected) {
            return;
        }
        
        if (command === "start") {
            this.state.spoolNumber++;
            this.saveSettings();
            this.createCsvFile(); // Create new CSV file
            this.device.on('diameter', this.boundHandleDiameter);
            this.device.startReading();
            this.state = {
                ...this.state,
                recording: true,
                min: Infinity,
                max: 0
            };
            console.log(this.state.spoolNumber);
            this.emit('stateChange', this.state);
        } else if (command === "stop") {
            this.device.stopReading();
            this.device.removeListener('diameter', this.boundHandleDiameter);
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

    /**
     * Handle diameter data from any device
     * @param diameter - Diameter in millimeters (mm)
     */
    private handleDiameter(diameter: number): void {
        if (diameter > this.state.max) {
            this.state.max = diameter;
            this.emit('stateChange', this.state);
        }
        if (diameter < this.state.min) {
            this.state.min = diameter;
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