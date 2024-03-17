const net = require('net');
const {parse} = require('yargs');
const crypto = require('crypto');
const Singleton = require('./Singleton.js');

// Function to generate peer ID using shake256 hash function
function getPeerID(ip, port) {
    const inputString = `${ip}:${port}`;
    const hash = crypto.createHash('shake256');
    hash.update(inputString);
    const hashBuffer = hash.digest();
    const peerID = hashBuffer.readUInt32LE(0);
    return peerID.toString(16).padStart(8, '0');
}

// Function to connect to the known peer (server)
function connectToServer(serverIP, serverPort, clientID) {
    const client = new net.Socket();
    client.connect(serverPort, serverIP, () => {
        console.log(`Connected to peer1:${serverPort} at timestamp: ${Singleton.getTimestamp()}`);
        const address = client.address();
        console.log(`Assigned ephemeral source port: ${address.port}`);
        console.log(`Current host IPv4 address: ${address.address}`);
        console.log(`Generated client ID: ${clientID}`);
        sendHello(client);
    });

    client.on('connect', () => {
        console.log('Connection established with the server.');
    });

    client.on('data', (data) => {
        const message = data.toString();
        console.log('Received message from server:', message);
        processServerMessage(message);
    });


    client.on('close', () => {
        console.log('Connection with server closed.');
    });

    client.on('error', (err) => {
        console.error('Error with server connection:', err);
    });
}


// Function to send a hello message to the server
function sendHello(client) {
    // Construct the hello message packet
    const helloMessage = {
        messageType: 1,
        serverID: 'sampleServerID',
        dht: 'sampleDHT'
    };
    client.write(JSON.stringify(helloMessage));
}

// Function to process server messages
function processServerMessage(message) {
    const parsedMessage = JSON.parse(message);
    switch (parsedMessage.messageType) {
        case 1: // Welcome message
            console.log(`Received Welcome Message from server ${parsedMessage.serverID} along with DHT:`);
            console.log(parsedMessage.dht);
            break;
        case 2: // DHT update
            console.log(`Received DHT Update from server ${parsedMessage.serverID}:`);
            console.log(parsedMessage.update);
            break;
        default:
            console.log('Unknown message type received.');
    }
}

// Function to initialize the client
function initializeClient() {
    const argv = parse();
    const serverArg = argv.p;
    if (serverArg) {
        const [serverIP, serverPort] = serverArg.split(':');
        const clientID = getPeerID();
        connectToServer(serverIP, serverPort, clientID);
    } else {
        console.error('Error: -p option with server IP address and port number is required.');
    }
}

initializeClient();
