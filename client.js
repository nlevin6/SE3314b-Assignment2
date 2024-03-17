const net = require('net');
const { parse } = require('yargs');
const Singleton = require('./Singleton.js');

// Define constants
const K_BUCKET_SIZE = 1;
const K_BUCKET_COUNT = 32;

// Function to parse command-line arguments
function parseCommandLineArgs() {
    return parse();
}

// Function to generate peer ID using shake256 hash function
function getPeerID(ip, port) {
    return Singleton.getPeerID(ip, port);
}

// Function to connect to the known peer
function connectToKnownPeer(peerIP, peerPort) {
    const client = new net.Socket();

    client.connect(peerPort, peerIP, () => {
        console.log('Connected to known peer.');
        const address = client.address();
        const peerID = getPeerID(address.address, address.port);
        console.log(`Assigned ephemeral source port: ${address.port}`);
        console.log(`Current host IPv4 address: ${address.address}`);
        console.log(`Generated DHT peerID: ${peerID}`);
    });

    // Event handler for data received from the known peer
    client.on('data', (data) => {
        const message = data.toString();
        console.log('Received message from known peer:', message);
        // Implement message processing logic here
    });

    // Event handler for connection closed
    client.on('close', () => {
        console.log('Connection with known peer closed.');
    });

    // Event handler for connection error
    client.on('error', (err) => {
        console.error('Error with known peer connection:', err);
    });
}

// Function to refresh the DHT table with a list of peers' information
function refreshBuckets(dhtTable, peersInfoList) {
    // Iterate through the list of peers' information
    for (const peerInfo of peersInfoList) {
        // Attempt to add each peer to the appropriate k-bucket of the DHT table
        pushBucket(dhtTable, peerInfo);
    }

    // Print the current DHT table
    console.log('Updated DHT table:');
    console.log(dhtTable);
}

// Function to send a hello message to every peer in the DHT table
function sendHello(dhtTable) {
    // Iterate through the k-buckets of the DHT table
    for (const bucket of dhtTable) {
        // Iterate through the peers in the current k-bucket
        for (const peer of bucket) {
            // Create a TCP socket to connect to the peer
            const client = new net.Socket();

            // Connect to the peer
            client.connect(peer.port, peer.ip, () => {
                console.log('Connected to peer for sending hello message:', peer.name);

                // Construct the hello message packet
                const helloMessage = {
                    messageType: 2, // 2 means Hello
                    knownPeers: dhtTable.flat() // Include information about all known peers
                };

                // Send the hello message to the peer
                client.write(JSON.stringify(helloMessage));
            });

            // Event handler for connection closed
            client.on('close', () => {
                console.log('Connection with peer closed after sending hello message:', peer.name);
            });

            // Event handler for connection error
            client.on('error', (err) => {
                console.error('Error with peer connection while sending hello message:', err);
            });
        }
    }
}


// Function to initialize the client
function initializeClient() {
    // Parse command-line arguments
    const argv = parseCommandLineArgs();

    // Extract known peer's IP address and port number from command-line arguments
    const peerArg = argv.p;
    if (peerArg) {
        const [peerIP, peerPort] = peerArg.split(':');
        connectToKnownPeer(peerIP, peerPort);
    } else {
        console.error('Error: -p option with known peer IP address and port number is required.');
    }
}

// Start the client
initializeClient();
