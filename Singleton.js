const crypto = require('crypto');

let sequenceNumber;
let timerInterval = 10;
let timer = 0;

function timerRun() {
    timer++;
    if (timer == 4294967295) {
        timer = Math.floor(1000 * Math.random()); // reset timer to be within 32 bit size
    }
}

module.exports = {
    init: function() {
        timer = Math.floor(1000 * Math.random()); /* any random number */
        setInterval(timerRun, timerInterval);
        sequenceNumber = Math.floor(1000 * Math.random()); /* any random number */
    },

    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {
        sequenceNumber ++;
        return sequenceNumber;
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return timer;
    },
    
    //--------------------------
    //getServerID: takes the IP and port number and returns 4 bytes Hex number
    //--------------------------
    getServerID: function(IP, port) {
        const inputString = `${IP}:${port}`;
        const hash = crypto.createHash('sha256');
        hash.update(inputString);
        const hashBuffer = hash.digest();
        const peerID = hashBuffer.readUInt32LE(0);
        return peerID.toString(16).padStart(8, '0');
    },

    //--------------------------
    //getPeerID: takes the IP and port number and returns 4 bytes Hex number
    //--------------------------
    getPeerID: function getPeerID(ip, port) {
        const inputString = `${ip}:${port}`;
        const hash = crypto.createHash('shake256');
        hash.update(inputString);
        const hashBuffer = hash.digest();
        const peerID = hashBuffer.readUInt32LE(0);
        return peerID.toString(16).padStart(8, '0');
    },

    //--------------------------
    //Hex2Bin: convert Hex string into binary string
    //--------------------------
    Hex2Bin: function (hex) {
        var bin = ""
        hex.split("").forEach(str => {
            bin += parseInt(str, 16).toString(2).padStart(8, '0')
        })
        return bin
    },

    //--------------------------
    //XORing: finds the XOR of the two Binary Strings with the same size
    //--------------------------
    XORing: function (a, b){
    let ans = "";
        for (let i = 0; i < a.length ; i++)
        {
            // If the Character matches
            if (a[i] == b[i])
                ans += "0";
            else
                ans += "1";
        }
        return ans;
    }

};