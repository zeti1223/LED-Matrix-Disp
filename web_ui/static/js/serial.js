class SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.connected = false;
        this.baudRate = 9600;
        this.dataListeners = [];
        this.connectListeners = [];
        this.disconnectListeners = [];
    }

    async requestPort() {
        if (!('serial' in navigator)) {
            throw new Error('Web Serial API not supported in this browser');
        }

        try {
            this.port = await navigator.serial.requestPort();
            return true;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                throw new Error('No port selected');
            }
            throw error;
        }
    }

    async connect() {
        if (!this.port) {
            throw new Error('No port selected. Call requestPort() first.');
        }

        try {
            await this.port.open({ baudRate: this.baudRate });
            this.connected = true;

            // Set up raw writer for both text and binary data
            this.writer = this.port.writable.getWriter();

            // Set up reader
            const decoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(decoder.writable);
            this.reader = decoder.readable.getReader();

            // Start reading loop
            this.readLoop();

            // Notify listeners
            this.connectListeners.forEach(listener => listener(true));
            appendConsole('[serial] Connected\n');

            return true;
        } catch (error) {
            this.connected = false;
            throw error;
        }
    }

    async disconnect() {
        this.connected = false;

        if (this.reader) {
            try {
                await this.reader.cancel();
                await this.readableStreamClosed.catch(() => { });
                this.reader = null;
            } catch (error) {
                console.error('Error closing reader:', error);
            }
        }

        if (this.writer) {
            try {
                await this.writer.close();
                await this.writableStreamClosed.catch(() => { });
                this.writer = null;
            } catch (error) {
                console.error('Error closing writer:', error);
            }
        }

        if (this.port) {
            try {
                await this.port.close();
                this.port = null;
            } catch (error) {
                console.error('Error closing port:', error);
            }
        }

        // Notify listeners
        this.disconnectListeners.forEach(listener => listener());
        appendConsole('[serial] Disconnected\n');
    }

    async send(command) {
        if (!this.connected || !this.writer) {
            throw new Error('Not connected');
        }

        try {
            const encoder = new TextEncoder();
            await this.writer.write(encoder.encode(command + '\n'));
            return true;
        } catch (error) {
            console.error('Error sending command:', error);
            throw error;
        }
    }

    async sendBytes(data) {
        if (!this.connected || !this.writer) {
            throw new Error('Not connected');
        }

        try {
            // Send raw binary data
            const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data);
            await this.writer.write(uint8Array);
            return true;
        } catch (error) {
            console.error('Error sending bytes:', error);
            throw error;
        }
    }

    async sendCommandWithBinary(command, binaryData) {
        if (!this.connected || !this.writer) {
            throw new Error('Not connected');
        }

        try {
            // Send text command
            const encoder = new TextEncoder();
            await this.writer.write(encoder.encode(command + '\n'));

            // Send binary data
            if (binaryData && binaryData.length > 0) {
                const uint8Array = binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData);
                await this.writer.write(uint8Array);
                // Wait for binary data to be transmitted
                await new Promise(resolve => setTimeout(resolve, 50));
                // Send newline after binary data
                await this.writer.write(encoder.encode('\n'));
            }

            return true;
        } catch (error) {
            console.error('Error sending command with binary:', error);
            throw error;
        }
    }

    async readLoop() {
        while (this.connected && this.reader) {
            try {
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    this.dataListeners.forEach(listener => listener(value));
                    appendConsole(value);
                }
            } catch (error) {
                if (this.connected) {
                    console.error('Error reading from serial port:', error);
                }
                break;
            }
        }
    }

    onData(callback) {
        this.dataListeners.push(callback);
    }

    onConnect(callback) {
        this.connectListeners.push(callback);
    }

    onDisconnect(callback) {
        this.disconnectListeners.push(callback);
    }

    isConnected() {
        return this.connected;
    }
}

// Create global instance
const serialManager = new SerialManager();
window.serialManager = serialManager;
