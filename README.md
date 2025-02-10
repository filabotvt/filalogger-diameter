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

The architecture of this project is it is built using electron. There is node backend and chrome app front end. They both are separate processes and communicate via ipc.
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





