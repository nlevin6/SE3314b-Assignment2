const net = require('net');
const {parse} = require('yargs');
const Singleton = require('./Singleton.js');
const crypto = require('crypto');

const argv = parse(process.argv.slice(2));
const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Function to calculate the common prefix length between two IDs
function calculateCommonPrefixLength(id1, id2) {
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

// Function to push a peer into the appropriate k-bucket of the DHT table
function pushBucket(dhtTable, peer) {
    const ownerID = dhtTable.ownerID;
    const bucketIndex = calculateCommonPrefixLength(ownerID, peer.id);

    if (dhtTable[bucketIndex].length < K_BUCKET_SIZE) {
        dhtTable[bucketIndex].push(peer);
        console.log(`Peer ${peer.name} added to bucket ${bucketIndex}.`);
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
}


function getServerID(ip, port) {
    const inputString = `${ip}:${port}`;
    const hash = crypto.createHash('shake256');
    hash.update(inputString);
    const hashBuffer = hash.digest();
    const serverID = hashBuffer.readUInt32LE(0);
    return serverID.toString(16).padStart(8, '0');
}

// Function to handle a joining peer
function handleClientJoining(socket, dhtTable) {
    socket.once('data', (data) => {
        const message = data.toString();
        console.log('Received message from joining peer:', message);
        const parsedMessage = JSON.parse(message);
        const welcomeMessage = {
            V: 9,
            messageType: 1,
            numberOfPeers: dhtTable.length,
            senderNameLength: 0,
            senderName: '',
            peerTable: dhtTable
        };

        socket.write(JSON.stringify(welcomeMessage));

        const peerInfo = {
            ip: socket.remoteAddress,
            port: socket.remotePort,
            id: parsedMessage.peerID
        };
        pushBucket(dhtTable, peerInfo);
        console.log('Updated DHT table after adding the joining peer:', dhtTable);
        socket.end();
    });
    socket.on('close', () => {
        console.log('Connection with joining peer closed.');
    });
    socket.on('error', (err) => {
        console.error('Error with joining peer connection:', err);
    });
}

// Function to initialize the server
function initializeServer(peerName) {
    const serverID = getServerID('127.0.0.1', 4897);
    const dhtTable = {
        ownerID: serverID,
        buckets: Array.from({length: K_BUCKET_COUNT}, () => [])
    };
    const server = net.createServer();

    server.on('connection', (socket) => {
        console.log('New connection established.');

        handleClientJoining(socket, dhtTable);
    });

    server.on('listening', () => {
        const address = server.address();
        const serverAddress = `${address.address}:${address.port}`;
        console.log(`This peer address is ${serverAddress} located at ${peerName} [${serverID}]`);
    });

    server.on('error', (err) => {
        console.error('Server error:', err);
    });

    server.listen(0, '127.0.0.1', () => {});

}

const peerName = argv.n || 'server';
initializeServer(peerName);

