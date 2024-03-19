const net = require('net');
const {parse} = require('yargs');
const crypto = require('crypto');
const Singleton = require('./Singleton.js');
const {pushBucket} = require('./KADpeer.js');

const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Function to generate peer ID
function getPeerID(ip, port) {
    const inputString = `${ip}:${port}`;
    const hash = crypto.createHash('shake256');
    hash.update(inputString);
    const hashBuffer = hash.digest();
    const peerID = hashBuffer.readUInt32LE(0);
    return peerID.toString(16).padStart(8, '0');
}

function getRandomPort() {
    const server = net.createServer();
    server.unref(); // Allow the program to exit even if the server is listening
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

// Function to connect to the known peer (server)
function connectToServer(serverIP, serverPort, clientID, dhtTable, argv) {
    const client = new net.Socket();
    client.connect(serverPort, serverIP, () => {
        console.log(`Connected to peer1:${serverPort} at timestamp: ${Singleton.getTimestamp()}\n`);
        const address = client.address();
        console.log(`This peer is ${address.address}:${address.port} located at peer2 [${clientID}]\n`);
        const peerName = argv.n || 'peer';
        sendHello(client, dhtTable, peerName);
    });

    client.on('connect', () => {
    });

    client.on('data', (data) => {
        const message = data.toString();
        processServerMessage(message, dhtTable);
    });

    client.on('close', () => {
        console.log('Connection with server closed.');
    });

    client.on('error', (err) => {
        console.error('Error with server connection:', err);
    });
}

// Function to send a hello message to the server
async function sendHello(client, dhtTable, peerName) {
    const randomPort = await getRandomPort();
    const helloMessage = {
        messageType: 2,
        clientID: getPeerID('127.0.0.1', randomPort),
        peerName: peerName,
        dht: dhtTable
    };
    client.write(JSON.stringify(helloMessage));
}

// Function to process the server message
function processServerMessage(message, dhtTable) {
    try {
        const parsedMessage = JSON.parse(message);
        switch (parsedMessage.messageType) {
            case 1: // Welcome message
                console.log(`Received Welcome Message from server ${parsedMessage.senderName} along with DHT:`);
                console.log(formatDHTTable(parsedMessage.peerTable));
                break;
            case 2: // DHT update
                refreshBuckets(dhtTable, parsedMessage.update.peerInfo.id);
                break;
            default:
                console.log('Unknown message type received.');
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
}

// Function to format the DHT table
function formatDHTTable(dhtTable) {
    const formattedDHT = dhtTable.map((bucket, index) => {
        if (bucket.length === 0) {
            return '';
        } else {
            return `[P${index}, ${bucket.map(peer => `${peer.ip}:${peer.port}, ${peer.id}`).join("; ")}]`;
        }
    }).filter(entry => entry !== '');

    if (formattedDHT.length === 0) {
        return '[]';
    } else {
        return formattedDHT.join("\n");
    }
}

// Function to refresh the buckets
function refreshBuckets(dhtTable, peerID) {
    // Push the joining peer into the correct bucket
    pushBucket(dhtTable, {
        ip: '127.0.0.1',
        port: 4897,
        id: peerID
    });
}

// Function to initialize the client
async function initializeClient(argv) {
    const randomPort = await getRandomPort();
    const serverArg = argv.p;
    if (serverArg) {
        const [serverIP, serverPort] = serverArg.split(':');
        const clientID = getPeerID('127.0.0.1', randomPort);
        const dhtTable = Array.from({length: K_BUCKET_COUNT}, () => []);
        connectToServer(serverIP, serverPort, clientID, dhtTable, argv);
    } else {
        console.error('Error: -p option with server IP address and port number is required.');
    }
}

initializeClient(parse());
