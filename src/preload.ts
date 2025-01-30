import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('serialApi', {
    connectPort: async (portName: string) => {
        return await ipcRenderer.invoke('connect-port', portName);
    },
    onDiameterChange: (callback: (diameter: string) => void) => {
        ipcRenderer.on('diameterChange', (_event, data) => callback(data));
    },
    removeListeners: () => {
        ipcRenderer.removeAllListeners('diameterChange');
    }
});