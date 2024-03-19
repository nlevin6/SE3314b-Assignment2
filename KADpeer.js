const net = require('net');
const { parse } = require('yargs');
const Singleton = require('./Singleton.js');
const { getServerID } = require('./Singleton.js');

const argv = parse(process.argv.slice(2));
const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Determine if running in server mode or client mode
const isServerMode = !argv.p; // If -p (port) argument is not provided, assume server mode

// Function to calculate the common prefix length between two IDs
function calculateCommonPrefixLength(id1, id2) {
    //console.log("ID1:", id1);
    //console.log("ID2:", id2);
    const binaryId1 = Singleton.Hex2Bin(id1);
    const binaryId2 = Singleton.Hex2Bin(id2);

    let commonPrefixLength = 0;

    for (let i = 0; i < binaryId1.length && i < binaryId2.length; i++) {
        if (binaryId1[i] === binaryId2[i]) {
            commonPrefixLength++;
        } else {
            break;
        }
    }
    return commonPrefixLength;
}

function pushBucket(dhtTable, peer) {
    const ownerID = Singleton.getServerID('127.0.0.1', 4897);
    const bucketIndex = calculateCommonPrefixLength(ownerID, peer.id);

    if (dhtTable[bucketIndex].length < K_BUCKET_SIZE) {
        dhtTable[bucketIndex].push(peer);
        console.log(`\nConnected from peer ${peer.ip}:${peer.port}\n`);
        console.log(`Bucket P${bucketIndex} has no value, adding ${peer.id} `);
    } else {
        const existingPeer = dhtTable[bucketIndex][0];
        const distanceToPeer = Singleton.XORing(peer.id, ownerID);
        const distanceToExistingPeer = Singleton.XORing(existingPeer.id, ownerID);

        if (distanceToPeer < distanceToExistingPeer) {
            console.log(`Peer ${peer.name} added to bucket ${bucketIndex} because it is closer to owner.`);
        } else {
            console.log(`Peer ${existingPeer.name} kept in bucket ${bucketIndex} because it is closer to owner.`);
        }
    }

    console.log('\nMy DHT:');
    console.log(formatDHTTable(dhtTable));

    // Return the bucket index and peer information
    return { bucketIndex, ...peer };
}

module.exports = {
    pushBucket,
    calculateCommonPrefixLength
};

// Function to format DHT table entries
function formatDHTTable(dhtTable) {
    const formattedEntries = [];
    for (let i = 0; i < dhtTable.length; i++) {
        const bucket = dhtTable[i];
        for (let j = 0; j < bucket.length; j++) {
            const peer = bucket[j];
            const formattedEntry = `[P${i}, ${peer.ip}:${peer.port}, ${peer.id}]`;
            formattedEntries.push(formattedEntry);
        }
    }
    return formattedEntries.join(", ");
}

function handleClientJoining(socket, dhtTable) {
    socket.once('data', (data) => {
        const message = data.toString();
        const parsedMessage = JSON.parse(message);
        const clientID = Singleton.getPeerID('127.0.0.1', 5000);
        const bucketIndex = calculateCommonPrefixLength(clientID, parsedMessage.clientID);
        const welcomeMessage = {
            V: 9,
            messageType: 1,
            numberOfPeers: dhtTable.length,
            senderNameLength: 0,
            senderName: clientID,
            peerTable: dhtTable,
            bucketIndex: bucketIndex
        };

        socket.write(JSON.stringify(welcomeMessage));

        // Push the joining peer into the correct bucket
        const peerInfo = pushBucket(dhtTable, {
            ip: socket.remoteAddress,
            port: socket.remotePort,
            id: parsedMessage.clientID
        });

        // Access the bucket index and peer ID from peerInfo and send it to the client
        // Send the DHT update message with the correct messageType
        const dhtUpdateMessage = {
            messageType: 2,
            senderName: clientID,
            update: {
                bucketIndex: peerInfo.bucketIndex,
                peerInfo: {
                    ip: '127.0.0.1',
                    port: 4897,
                    id: clientID
                }
            }
        };

        socket.write(JSON.stringify(dhtUpdateMessage));

        socket.end();
    });
    socket.on('close', () => {
        console.log('Connection with joining peer closed.');
    });
    socket.on('error', (err) => {
        console.error('Error with joining peer connection:', err);
    });
}

const clients = [];

// Function to initialize the server
function initializeServer(peerName) {
    const serverID = getServerID('127.0.0.1', 4897);
    const dhtTable = Array.from({ length: K_BUCKET_COUNT }, () => []);
    const server = net.createServer();

    server.on('connection', (socket) => {
        clients.push(socket);
        handleClientJoining(socket, dhtTable);
    });

    server.on('listening', () => {
        if (isServerMode) {
            const address = server.address();
            const serverAddress = `${address.address}:${address.port}`;
            console.log(`This peer address is ${serverAddress} located at ${peerName} [${serverID}]`);
        }
    });

    server.on('error', (err) => {
        console.error('Server error:', err);
    });

    server.listen(0, '127.0.0.1', () => {
    });
}

const peerName = argv.n || 'server';
initializeServer(peerName);
