import Lnmessage from 'lnmessage';
import crypto from 'crypto';
import net from 'net';
import WebSocket from 'ws';
import fs from 'fs';
import { exit } from 'process';

const NODE_PUBKEY = '025323ec7b4ea37bd89f4175705f73acb7c0f4a15cb434c94383e9c3afcb231426';
const WS_PORT = 5019;
const WSS_PORT = 5020;
const TCP_PORT = 9735;
const NODE_IP = '127.0.0.1';
const RUNE = 'ZrAKX361xKHHcuO2MAuWY1LofVR8904APzkhDBd57BE9MA==';
const CALL_FREQUENCY = 5 * 1000 // Seconds

class SecureWebSocket extends WebSocket {
  constructor(url) {
    const options = {};
    options.rejectUnauthorized = false;
    options.cert = fs.readFileSync('/home/shahana/workspace/.lightning/l1-regtest/regtest/client.pem');
    options.key = fs.readFileSync('/home/shahana/workspace/.lightning/l1-regtest/regtest/client-key.pem');
    super(url, options);
  }
}

async function connect(connectOption) {
  console.warn('INITIALIZING ', connectOption || 'WS');
  let lnmessageOptions = {
    ip: NODE_IP,
    remoteNodePublicKey: NODE_PUBKEY,
    privateKey: crypto.randomBytes(32).toString('hex'),
    logger: { info: console.log, warn: console.warn, error: console.error }
  }
  switch (connectOption) {
    case 'TCP':
      lnmessageOptions = {...lnmessageOptions,
        tcpSocket: new net.Socket(),
        port: TCP_PORT,
      }
      break;
    case 'WSS':
      lnmessageOptions = {...lnmessageOptions,
        wsProxy: `wss://${NODE_IP}:${WSS_PORT}`,
        port: WSS_PORT,
      }
      globalThis.WebSocket = SecureWebSocket;
      break;
    case 'WS':
      lnmessageOptions = {...lnmessageOptions,
        wsProxy: `ws://${NODE_IP}:${WS_PORT}`,
        port: WS_PORT,
      }
      break;
    default:
      console.error('Invalid connection option');
      exit(1);
  }
  const ln = new Lnmessage(lnmessageOptions)

  console.warn('INITIALIZED');
  await ln.connect();
  console.warn('CONNECTED');
  
  ln.commando({reqId: crypto.randomBytes(8).toString('hex'), method: 'getinfo', params: [], rune: RUNE}).then(res => {
    console.warn('[WARN - ' + new Date().toISOString() + '] - ' + 'GETINFO' + ':\n' + JSON.stringify(res));
  }).catch(err => {
    console.error('[ERROR - ' + new Date().toISOString() + '] - ' + 'GETINFO' + ':\n' + JSON.stringify(err));  
  });

  setInterval(() => {
    console.info('AGAIN');
    ['getinfo', 'listpeers', 'listinvoices', 'listsendpays', 'listfunds', 'bkpr-listaccountevents', 'feerates'].map(method => {
      const reqId = crypto.randomBytes(8).toString('hex');
      ln.commando({ reqId, method, params: method === 'feerates' ? ['perkb'] : [], rune: RUNE }).then(res => {
        console.warn('[WARN - ' + new Date().toISOString() + '] - ' + method.toUpperCase() + ':\n' + JSON.stringify(res));
      }).catch(err => {
        console.error('[ERROR - ' + new Date().toISOString() + '] - ' + method.toUpperCase() + ':\n' + JSON.stringify(err));  
      });
    });
  }, CALL_FREQUENCY);
  
}

connect('WSS');
