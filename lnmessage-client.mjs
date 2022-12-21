import Lnmessage from 'lnmessage';

async function connect() {
  console.warn('Start');
  const ln = new Lnmessage({
    remoteNodePublicKey: '02f4df91118f943f07af246282f4af3c9dab08ed176980def21215070c457ba2b9',
    wsProxy: 'ws://127.0.0.1:5001',
    ip: '127.0.0.1',
    port: 19846,
    privateKey: 'ea8d3091934f2c86c216370f0206acaaa2ee12462387743c358ca5f0245bf561'
  })
  console.warn('INIT');

  await ln.connect()
  console.warn('CONNECT');

  ln.commando({
    method: 'getinfo',
    params: [],
    rune: 'SnG46kWc3a3qJPcEl0CDvIHsShYqIavwDLAcnQ3qRlM9MQ=='
  }).then(a => {
    console.warn('INFO');
    console.warn(a);
  }).catch(err => {
    console.error(err);
  });
}

connect();
