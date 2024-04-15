const LNSocket = require('lnsocket');
// import LNSocket from 'lnsocket';

async function go() {
	const ln = await LNSocket();
	ln.genkey();

	await ln.connect_and_init("025323ec7b4ea37bd89f4175705f73acb7c0f4a15cb434c94383e9c3afcb231426", "127.0.0.1:5019");
	
	const rune = "ZrAKX361xKHHcuO2MAuWY1LofVR8904APzkhDBd57BE9MA==";
	const res = await ln.rpc({ method: "getinfo", rune });
	
	ln.destroy();
	console.log(res);
	return res;
}

go();
