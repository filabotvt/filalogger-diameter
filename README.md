<h3>Build Instructions</h3>
First install node and npm. Then open project directory and run 
<code>npm install</code>

To run locally run
<code>npm run start</code>

To build executable for mac
<code>npm run build</code>
<code>npm run dist-mac</code>

To build executable for windows
<code>npm run build</code>
<code>npm run dist</code>

<div>The executables will be saved in releases folder. Make sure to modify the version inside package.json folder</div> To not get unidentified developer warning on the install, the executable has to be <a href="https://help.apple.com/xcode/mac/current/#/dev033e997ca">signed.</a>

<h3>Architecture</h3>
This project is built using electron and written in typescript. There is node backend and chrome app front end. They both are separate processes and communicate via ipc.
The backend has an event listener on serial data and whenever there is serial data, it parses the bits into a float and then pushes the float to the front.
The parsing logic is inside serial.ts. It is a thirteen byte string and the bytes of importance are 8,9 & 10
<code>

        function parseData(binaryString: string): number { 
            var dec = "" 
            getDec(32);
            dec += "."
            getDec(36);
            getDec(40);
            return parseFloat(dec);
            
            function getDec(index: number) {
                let binaryByte = binaryString.substring(index, index + 4).split("").reverse().join("")
                dec += parseInt(binaryByte, 2);  
            }
        }
</code>
Configuration data is stored in state and passed, back and forth via ipc. The state is stored in a json settings file, to maintain consistency between runs.

Note: The external measurement device is solar powered and needs light to work.


Latest releases are uploaded to https://github.com/filabotvt/filalogger-diameter/releases

