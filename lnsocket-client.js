import LNSocket from 'lnsocket';

async function go() {
	const ln = await LNSocket();
	ln.genkey();

	await ln.connect_and_init("02f4df91118f943f07af246282f4af3c9dab08ed176980def21215070c457ba2b9", "wss://127.0.0.1:5001");
	
	const rune = "SnG46kWc3a3qJPcEl0CDvIHsShYqIavwDLAcnQ3qRlM9MQ==";
	const res = await ln.rpc({ method: "getinfo", rune });
	
	ln.destroy();
	console.log(res);
	return res;
}

go();
