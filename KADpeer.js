const net = require('net');
const { parse } = require('yargs');
const Singleton = require('./Singleton.js');
const { getServerID } = require('./Singleton.js');

Singleton.init();

const argv = parse(process.argv.slice(2));
const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Determine if running in server mode or client mode
const isServerMode = !argv.p;

// Function to calculate the common prefix length between two IDs for bucket index
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

// Function to push the joining peer into the correct bucket
function pushBucket(dhtTable, peer) {
    const ownerID = Singleton.getServerID('127.0.0.1', 4897);
    const bucketIndex = calculateCommonPrefixLength(ownerID, peer.id);

    // If the bucket is empty, add the peer
    if (dhtTable[bucketIndex].length < K_BUCKET_SIZE) {
        dhtTable[bucketIndex].push(peer);
        console.log(`\nConnected from peer ${peer.ip}:${peer.port}\n`);
        console.log(`Bucket P${bucketIndex} has no value, adding ${peer.id} `);
    } else { // If the bucket is full, compare the distance of the new peer to the existing peer
        const existingPeer = dhtTable[bucketIndex][0];
        //console.log("existing peer: ", existingPeer);
        const distanceToPeer = Singleton.XORing(peer.id, ownerID);
        const distanceToExistingPeer = Singleton.XORing(existingPeer.id, ownerID);

        // If the new peer is closer to the owner, add it to the bucket
        if (distanceToPeer < distanceToExistingPeer) {
            console.log(`Peer ${peer.id} added to bucket ${bucketIndex} because it is closer to owner.`);
        } else { // If the existing peer is closer to the owner, keep it in the bucket
            console.log(`Peer ${existingPeer.id} kept in bucket ${bucketIndex} because it is closer to owner.`);
        }
    }

    console.log('\nMy DHT:');
    console.log(formatDHTTable(dhtTable));

    // Return the bucket index and peer information
    return { bucketIndex, ...peer };
}

module.exports = {
    pushBucket
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

// Function to handle the joining peer
function handleClientJoining(socket, dhtTable) {
    socket.once('data', (data) => {
        const message = data.toString();
        const parsedMessage = JSON.parse(message);
        const clientID = Singleton.getPeerID('127.0.0.1', 5000);

        // Calculate the common prefix length between the joining peer and the server
        const bucketIndex = calculateCommonPrefixLength(clientID, parsedMessage.clientID);

        console.log(`Received Hello Message from ${parsedMessage.peerName} ${parsedMessage.clientID} along with DHT:`);
        console.log(formatDHTTable(parsedMessage.dht));

        // Send the welcome message to the joining peer
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

        // Send the DHT update message to the joining peer
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
