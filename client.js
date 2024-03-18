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
function connectToServer(serverIP, serverPort, clientID, dhtTable) {
    const client = new net.Socket();
    client.connect(serverPort, serverIP, () => {
        console.log(`Connected to peer1:${serverPort} at timestamp: ${Singleton.getTimestamp()}\n`);
        const address = client.address();
        console.log(`This peer is ${address.address}:${address.port} located at peer2 [${clientID}]\n`);
        sendHello(client, dhtTable);
    });

    client.on('connect', () => {});

    client.on('data', (data) => {
        const message = data.toString();
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
function sendHello(client, dhtTable) {
    // Construct the hello message packet
    const helloMessage = {
        messageType: 2,
        clientID: getPeerID('127.0.0.1', 5000),
        dht: dhtTable
    };
    client.write(JSON.stringify(helloMessage));
}

// Function to process server messages
function processServerMessage(message) {
    const parsedMessage = JSON.parse(message);
    switch (parsedMessage.messageType) {
        case 1: // Welcome message
            console.log(`Received Welcome Message from server ${parsedMessage.senderName} along with DHT:`);
            console.log(parsedMessage.peerTable);
            break;
        case 2: // DHT update
            console.log(`Received DHT Update from server ${parsedMessage.senderName}:`);
            console.log(parsedMessage.update);
            // Assuming parsedMessage.update contains the list of peers
            if (parsedMessage.update && parsedMessage.update.length > 0) {
                // Assuming dhtTable is initialized elsewhere
                refreshBuckets(dhtTable, parsedMessage.update);
            }
            break;
        default:
            console.log('Unknown message type received.');
    }
}

function refreshBuckets(dhtTable, peerList) {
    peerList.forEach(peer => {
        pushBucket(dhtTable, peer);
    });
    console.log('Current DHT table after refreshing buckets:');
    console.log(dhtTable);
}

// Function to initialize the client
function initializeClient() {
    const argv = parse();
    const serverArg = argv.p;
    if (serverArg) {
        const [serverIP, serverPort] = serverArg.split(':');
        const clientID = getPeerID('127.0.0.1', 5000);
        const dhtTable = [];
        connectToServer(serverIP, serverPort, clientID, dhtTable);
    } else {
        console.error('Error: -p option with server IP address and port number is required.');
    }
}

initializeClient();
