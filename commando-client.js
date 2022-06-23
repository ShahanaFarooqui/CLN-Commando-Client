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
                } else if(data.length === 81) {
                    var len = _self.noise.decryptLength(data.slice(0,18));
                    var inti = data.slice(18,18+len+16);
                    let init_msg = _self.noise.decryptMessage(inti);
                    var pref = init_msg.slice(0,2).toString('hex');
                    init_msg = init_msg.slice(2);
                    if(pref = '0010'){
                        _self.socket.send(_self.noise.encryptMessage(Buffer.from(initMessage,'hex')));
                        console.log('Initial Message Sent!');
                        resolve(true);
                    }
                    else if(pref = '0011'){
                        console.error(init_msg);
                        _self.socket.close(1000,'Delibrate Closing After Error!');
                        _self.emit('error', {error: init_msg});
                    }
                } else if(data.length === 76) {
                    var len = _self.noise.decryptLength(data.slice(0,18));
                    var msg = _self.noise.decryptMessage(data.slice(18,18+len+16)).toString('hex');
                } else {
                    var len=_self.noise.decryptLength(data.slice(0,18));
                    var decr = _self.noise.decryptMessage(data.slice(18,18+len+16));
                    var hdecr = decr.slice(0,2).toString('hex');
                    if (hdecr === '4c4f' || hdecr === '594d') {
                        _self.emit('success', decr.slice(10).toString());
                    }
                }
            });
        });
    }

    call(method, args = []) {
        let _self = this;
        console.log('Calling ' + method);
        this.reqcount++;
        const command = {"method": method, "rune": this.rune, "params": args, "id": this.reqcount};
        this.connectionPromise.then((res) => {
            _self.socket.send(_self.noise.encryptMessage(Buffer.concat([Buffer.from('4c4f','hex'),Buffer.from([0,0,0,0,0,0,0,0]) ,Buffer.from(JSON.stringify(command))])));
        });
    }

}

module.exports = (nodeId, address, port, rune, localSecretKey, initMessage) => new CommandoClient(nodeId, address, port, rune, localSecretKey, initMessage);
module.exports.CommandoClient = CommandoClient;

// =======================================================================
// Initialize The client
// =======================================================================
// Mainnet Settings
// const NODE_ID = '02765a7196c191f5ee0f17382a4ec8a4b106f8fb7f299c9138375840da5218277d';
// const ADDRESS = '128.199.202.168';
// const PORT = '5001';
// const RUNE = 'g5c4LNf3r2pCiWvPHY64QostF9ysT0jkPiQUTmvL_tc9Mw==';
// const LOCAL_SECRET_KEY = 'ea8d3091934f2c86c216370f0206acaaa2ee12462387743c358ca5f0245bf561';
// const INIT_MESSAGE = '00100000000580082a6aa201206fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000';

// Testnet Settings
const NODE_ID = '031844beb16bf8dd8c7bc30588b8c37b36e62b71c6e812e9b6d976c0a57e151be2';
const ADDRESS = '69.122.24.206'; //'192.168.1.11';
const PORT = '5050';
const RUNE = 'eYDwzcBwaCehon-iyQy_dqSYrPkEE8K_-mMGzdoskUk9MA==';
const LOCAL_SECRET_KEY = 'ea8d3091934f2c86c216370f0206acaaa2ee12462387743c358ca5f0245bf561';
const INIT_MESSAGE = '00100000000580082a6aa2012043497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000';

let commandoClient = new CommandoClient(NODE_ID, ADDRESS, PORT, RUNE, LOCAL_SECRET_KEY, INIT_MESSAGE);
commandoClient.call('getinfo', []);
commandoClient.call('feerates', ['perkw']);
commandoClient.call('signmessage', ['Testing Sign Message Via Commando']);

// ERROR
commandoClient.call('getinfos', []);

commandoClient.on('success', res => console.log('Response: \n' + res));
commandoClient.on('error', err => console.error('Error: \n' + err));
