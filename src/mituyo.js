#!/usr/bin/env node

const usb = require('usb');

const VENDOR_ID = 0x0fe7;
const PRODUCT_ID = 0x4001;
const MAX_PKT = 64;

/**
 * Detect whether measurement is in inches or mm based on format:
 * - Inches: 01A+000.0000 (3 digits before decimal, 4 after)
 * - MM: 01A+00000.00 (5 digits before decimal, 2 after)
 */
function detectUnit(decoded) {
    // Find the decimal point position
    const dotPos = decoded.indexOf('.');
    if (dotPos === -1) {
        return 'unknown';
    }
    
    // Find the '+' sign (should be at position 3)
    let signPos = decoded.indexOf('+');
    if (signPos === -1) {
        signPos = decoded.indexOf('-');  // Handle negative values
    }
    if (signPos === -1) {
        return 'unknown';
    }
    
    // Count digits between '+'/'-' and '.'
    const digitsBeforeDecimal = dotPos - signPos - 1;
    
    // Inches format has 3 digits before decimal, mm has 5
    if (digitsBeforeDecimal === 3) {
        return 'inches';
    } else if (digitsBeforeDecimal === 5) {
        return 'mm';
    } else {
        return 'unknown';
    }
}

// Helper function to promisify control transfer
function controlTransfer(device, bmRequestType, bRequest, wValue, wIndex, dataOrLength) {
    return new Promise((resolve, reject) => {
        device.controlTransfer(bmRequestType, bRequest, wValue, wIndex, dataOrLength, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Helper function to promisify endpoint transfer
function endpointTransfer(endpoint, length) {
    return new Promise((resolve, reject) => {
        endpoint.transfer(length, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function main() {
    let device;
    let iface;
    
    try {
        // Find device
        device = usb.findByIds(VENDOR_ID, PRODUCT_ID);
        
        if (!device) {
            console.error("No Mitutoyo device matching 0fe7:4001 found");
            process.exit(1);
        }
        
        // Open device
        device.open();
        
        // Skip device.reset() - not supported on Windows with WinUSB
        
        // Set configuration (may fail on Windows if already configured - that's OK)
        try {
            await new Promise((resolve, reject) => {
                device.setConfiguration(1, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (e) {
            // Ignore - device may already be configured
            console.log(`Note: setConfiguration returned: ${e.message} (continuing anyway)`);
        }
        
        // Claim interface
        iface = device.interface(0);
        try {
            // isKernelDriverActive() is Linux-only, will throw on Windows
            if (iface.isKernelDriverActive()) {
                iface.detachKernelDriver();
            }
        } catch (e) {
            // Ignore - not supported on Windows
        }
        iface.claim();
        
        // Get endpoint
        const endpoints = iface.endpoints;
        const epin = endpoints.find(ep => ep.direction === 'in');
        
        if (!epin) {
            console.error("Error: Could not find input endpoint");
            process.exit(1);
        }
        
        // Initial setup commands
        // Setup command 1: Vendor Host-to-Device
        try {
            await controlTransfer(device, 0x40, 0x01, 0xA5A5, 0, Buffer.alloc(0));
        } catch (e) {
            console.error(`Error in setup command 1: ${e.message}`);
        }
        
        // Setup command 2: Vendor Device-to-Host
        try {
            const res1 = await controlTransfer(device, 0xC0, 0x02, 0, 0, 1);
            // console.debug(`Device Vendor resp: ${res1.toString('hex')}`);
        } catch (e) {
            console.error(`Error in setup command 2: ${e.message}`);
        }
        
        // Small delay after setup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("Reading measurements (Press Ctrl+C to stop)...");
        
        let shouldStop = false;
        
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            console.log("\nStopping...");
            shouldStop = true;
        });
        
        // Continuous reading loop
        while (!shouldStop) {
            try {
                // Send read command
                await controlTransfer(device, 0x40, 0x03, 0, 0, Buffer.from("1\r", 'ascii'));
                
                // Small delay before reading
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Read measurement
                const data = await endpointTransfer(epin, MAX_PKT);
                const decoded = data.toString('ascii').trim();
                
                // Detect unit based on format
                const unit = detectUnit(decoded);
                
                // Extract just the numeric value: skip "01A" prefix, keeps sign
                let value = parseFloat(decoded.substring(3));
                
                // Convert to mm if in inches (1 inch = 25.4 mm)
                if (unit === 'inches') {
                    value = value * 25.4;
                }
                
                console.log(`Measurement: ${value.toFixed(2)} mm`);
                
                // Small delay to avoid overwhelming the device
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                if (!shouldStop) {
                    console.error(`Error during reading: ${e.message}`);
                }
                // Small delay on error before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
    } catch (e) {
        console.error(`Error: ${e.message}`);
    } finally {
        // Cleanup
        console.log("Cleaning up...");
        try {
            if (iface) {
                iface.release();
            }
        } catch (e) {
            // Ignore errors during cleanup
        }
        try {
            if (device) {
                device.close();
            }
        } catch (e) {
            // Ignore errors during cleanup
        }
        console.log("Done.");
    }
}

main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
});

