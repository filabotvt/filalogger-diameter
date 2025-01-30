import { contextBridge, ipcRenderer } from 'electron';
import { SerialState } from './serial';

contextBridge.exposeInMainWorld('serialApi', {
    connectPort: async (portName: string) => {
        return await ipcRenderer.invoke('connect-port', portName);
    },
    onDiameterChange: (callback: (diameter: string) => void) => {
        ipcRenderer.on('diameterChange', (_event, data) => callback(data));
    },
    onStateChange: (callback: (state: SerialState) => void) => {
        ipcRenderer.on('stateChange', (_event, data) => {
            callback(data)
        });
    },
    removeListeners: () => {
        ipcRenderer.removeAllListeners('diameterChange');
        ipcRenderer.removeAllListeners('stateChange');
    },
    sendCommand: (command: string) => {
        return ipcRenderer.invoke('send-command', command);
    },
    openFolder: (command: string) => {
        return ipcRenderer.invoke('open-folder');
    }
});