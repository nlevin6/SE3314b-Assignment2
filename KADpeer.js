const net = require('net');
const { parse } = require('yargs');
const Singleton = require('./Singleton.js');
const crypto = require('crypto');

// Define constants
const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Function to calculate the common prefix length between two IDs
function calculateCommonPrefixLength(id1, id2) {
    // Convert IDs to binary strings
    const binaryId1 = Singleton.Hex2Bin(id1);
    const binaryId2 = Singleton.Hex2Bin(id2);

    // Initialize common prefix length
    let commonPrefixLength = 0;

    // Iterate through the binary strings and compare each character
    for (let i = 0; i < binaryId1.length && i < binaryId2.length; i++) {
        // If characters match, increment common prefix length
        if (binaryId1[i] === binaryId2[i]) {
            commonPrefixLength++;
        } else {
            // If characters don't match, break the loop
            break;
        }
    }

    return commonPrefixLength;
}


// Function to push a peer into the appropriate k-bucket of the DHT table
function pushBucket(dhtTable, peer) {
    const ownerID = dhtTable.ownerID; // Assuming dhtTable has an ownerID property

    // Determine the maximum number of leftmost bits shared between P and P′
    // Get the index of the corresponding k-bucket
    const bucketIndex = calculateCommonPrefixLength(ownerID, peer.id);

    // Check if the k-bucket is empty
    if (dhtTable[bucketIndex].length < K_BUCKET_SIZE) {
        // Insert the peer into the k-bucket
        dhtTable[bucketIndex].push(peer);
        console.log(`Peer ${peer.name} added to bucket ${bucketIndex}.`);
    } else {
        // Find the existing peer in the k-bucket
        const existingPeer = dhtTable[bucketIndex][0]; // Assuming K_BUCKET_SIZE is 1

        // Calculate the distance between P and P′
        const distanceToPeer = Singleton.XORing(peer.id, ownerID);
        const distanceToExistingPeer = Singleton.XORing(existingPeer.id, ownerID);

        // Choose the closer peer
        let chosenPeer;
        if (distanceToPeer < distanceToExistingPeer) {
            chosenPeer = peer;
            console.log(`Peer ${peer.name} added to bucket ${bucketIndex} because it is closer to owner.`);
        } else {
            chosenPeer = existingPeer;
            console.log(`Peer ${existingPeer.name} kept in bucket ${bucketIndex} because it is closer to owner.`);
        }
    }
}

// Function to generate peer ID using shake256 hash function
function getPeerID(ip, port) {
    const inputString = `${ip}:${port}`;
    const hash = crypto.createHash('shake256');
    hash.update(inputString);
    const hashBuffer = hash.digest();
    // Extract the first 4 bytes (32 bits) of the hash as the peer ID
    const peerID = hashBuffer.readUInt32LE(0);
    return peerID.toString(16).padStart(8, '0'); // Convert to hexadecimal and pad with zeros to ensure fixed length
}

// Function to handle a joining peer
function handleClientJoining(socket) {
    // Event handler for data received from the joining peer
    socket.on('data', (data) => {
        // Convert the received data to a string
        const message = data.toString();
        console.log('Received message from joining peer:', message);

        // Parse the message to extract relevant information
        const parsedMessage = JSON.parse(message);
        const peerName = parsedMessage.peerName;
        const peerIP = parsedMessage.peerIP;
        const peerPort = parsedMessage.peerPort;

        // Generate peer ID based on IP address and port
        const peerID = getPeerID(peerIP, peerPort);

        // Create a peer object with extracted information
        const peer = {
            name: peerName,
            ip: peerIP,
            port: peerPort,
            id: peerID
        };

        // Push the peer into the appropriate k-bucket of the DHT table
        pushBucket(dhtTable, peer);

        // Example: Send a response back to the joining peer if necessary
        // socket.write('Welcome to the network!');
    });

    // Event handler for connection closed
    socket.on('close', () => {
        console.log('Connection with joining peer closed.');
    });

    // Event handler for connection error
    socket.on('error', (err) => {
        console.error('Error with joining peer connection:', err);
    });
}


// Function to initialize the server
function initializeServer() {
    // Generate peer ID based on IP address and port
    const peerID = getPeerID('127.0.0.1', 4897); // Example IP and port, replace with actual values

    // Create DHT table with owner ID and empty k-buckets
    const dhtTable = {
        ownerID: peerID,
        buckets: Array.from({ length: K_BUCKET_COUNT }, () => [])
    };

    // Create a TCP server
    const server = net.createServer();

    // Event handler for when a new client is attempting to connect
    server.on('connection', (socket) => {
        console.log('New connection established.');

        // Handle the joining peer
        handleClientJoining(socket);
    });

    // Event handler for when the server is listening
    server.on('listening', () => {
        const address = server.address();
        const serverAddress = `${address.address}:${address.port}`;
        console.log(`This peer address is ${serverAddress} located at server [${peerID}]`);
    });

    // Event handler for server error
    server.on('error', (err) => {
        console.error('Server error:', err);
    });

    // Start the server on an IPv4 address and an ephemeral port
    server.listen(4984, '127.0.0.1', () => {
        //const address = server.address();
        //const serverAddress = `${address.address}:${address.port}`;
    });
}

// Start the server
initializeServer();

