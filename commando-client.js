'use strict';
const {EventEmitter} = require('events');
const WebSocket= require('ws');
const secp256k1 = require('secp256k1');
const { randomBytes } = require('crypto')
const { NoiseState }=require('./noise.js');

class CommandoClient extends EventEmitter {
    constructor(nodeId, address, port, rune, localSecretKey, initMessage) {
        super();
        console.log('Connecting to node ' + nodeId);
        this.node_id = nodeId;
        this.address = address;
        this.port = port;
        this.rune = rune;
        this.local_secret_key = localSecretKey;
        this.reqcount = 0;
        var link = 'ws://' + address + ':' + port;
        var ls = Buffer.from(this.local_secret_key, 'hex');
        var es;
        do {
            es = randomBytes(32);
        } while (!secp256k1.privateKeyVerify(es))
        var vals = { ls, es };
        this.noise = new NoiseState(vals);
        this.socket = new WebSocket(link);
        this.rpk = Buffer.from(this.node_id,'hex');
        const _self = this;

        this.connectionPromise = new Promise((resolve, reject) => {
            _self.socket.on('open', () => {
                _self.socket.send(_self.noise.initiatorAct1(_self.rpk));
                console.log('Socket Opened!');
            });
        
            _self.socket.on('close', () => {
                console.log('Socket Closed!');
                return ([
                { 'rn':_self.noise.rn, 'sn':_self.noise.sn },
                { 'sk':_self.noise.sk, 'rk':_self.noise.rk },
                { 'ck':_self.noise.ck }
                ]);
            });
        
            _self.socket.on('error', error => {
                console.error('Socket Error: ' + JSON.stringify(error));
                _self.emit('error', error);
            });

            _self.socket.on('message', (data) => {
                if(data.length < 50) {
                    _self.emit('error', {error: 'Error Incorrect Data!'});
                } else if(data.length === 50) {
                    _self.noise.initiatorAct2(data);
                    var Act3 = _self.noise.initiatorAct3();
                    _self.socket.send(Act3);
                    console.log('Connection Established!');
                } else {
                    let len = _self.noise.decryptLength(data.slice(0,18));
                    let init_msg = _self.noise.decryptMessage(data.slice(18,18+len+16));
                    let pref = init_msg.slice(0,2).toString('hex');
                    let msg = init_msg.slice(2);
                    if(pref === '0010'){
                        _self.socket.send(_self.noise.encryptMessage(Buffer.from(initMessage,'hex')));
                        console.log('Initial Message Sent!');
                        resolve(true);
                    } else if(pref === '0011'){
                        console.error(msg);
                        _self.socket.close(1000,'Delibrate Closing After Error!');
                        _self.emit('error', {error: msg});
                    } else if (pref === '4c4f' || pref === '594d') {
                        _self.emit('success', init_msg.slice(10).toString());
                    }
                }
            });
        });
    }

    call(method, args = []) {
        let _self = this;
        console.log('Calling ' + method);
        this.reqcount++;
        const command = {"method": method, "rune": this.rune, "params": args, "id": 'client' + '-' + method + '-' + this.reqcount};
        console.warn(command);
        this.connectionPromise.then((res) => {
            _self.socket.send(_self.noise.encryptMessage(Buffer.concat([Buffer.from('4c4f','hex'), Buffer.from([0,0,0,0,0,0,0,0]), Buffer.from(JSON.stringify(command))])));
        });
    }

}

module.exports = (nodeId, address, port, rune, localSecretKey, initMessage) => new CommandoClient(nodeId, address, port, rune, localSecretKey, initMessage);
module.exports.CommandoClient = CommandoClient;

// =======================================================================
// Initialize The client
// =======================================================================

// (workspace/.lightning/l1-regtest)
const NODE_ID = '03d2d3b2a916933d322f2dbad018952192cb295c6e0d94ad5288989780f8303bfe';
const ADDRESS = '127.0.0.1';
const PORT = '5001';
const RUNE = 'vzspW0LIOA0_ZNfJt-ljRccgJNFxx7ra0H65slJ_DJk9MA==';

const LOCAL_SECRET_KEY = 'ea8d3091934f2c86c216370f0206acaaa2ee12462387743c358ca5f0245bf561';
const INIT_MESSAGE = '001000000000';

let commandoClient = new CommandoClient(NODE_ID, ADDRESS, PORT, RUNE, LOCAL_SECRET_KEY, INIT_MESSAGE);
setInterval(() => {
    commandoClient.call('getinfo', []);
    commandoClient.call('listpeers', []);
    // commandoClient.call('listinvoices', []);
    // commandoClient.call('listsendpays', []);
    // commandoClient.call('listfunds', []);
    // commandoClient.call('bkpr-listaccountevents', []);
    // commandoClient.call('feerates', ['perkb']);
    // commandoClient.call('getinfos', []);
    // console.info('Calling again');
  }, 500);
  
commandoClient.on('success', res => {
    res = JSON.parse(res);
    if (res.result) {
        console.log('Response: ' + res.id + '\n' + JSON.stringify(res.result) + '\n');
    } else {
        console.error('Error: ' + res.id + '\n' + JSON.stringify(res.error) + '\n');
    }
});

commandoClient.on('error', err => {
    err = JSON.parse(err);
    console.error('Error: \n' + JSON.stringify(err) + '\n');
});
