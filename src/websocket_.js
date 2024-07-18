const http = require('node:http')
const {EventEmitter} = require('node:events')
const  crypto  = require('crypto')

const server = http.createServer((req, res) => {

	const UPGRADE_REQUIRE = 426;
	const body = http.STATUS_CODES[UPGRADE_REQUIRE];

		res.writeHead(UPGRADE_REQUIRE, {
			'Content-Type' : 'text/plain',
			'Upgrade' : 'WebSocket',
	});
	res.end(body)
});

server.on('upgrade' , (req,socket) => {


	if(req.headers.upgrade !== 'websocket') {

		socket.end('HTTP/1.1 400 Bad Request')
		return ;
	}
	const acceptKey = req.headers['sec-websocket-key'];
	const acceptValue = generateAcceptValue(acceptKey);


	const responseHeaders = [
		'HTTP1.1 101 Switching Protocols',
		'Upgrade : websocket',
		'Connection : Upgrade',
		`Sec-WebSocket-Accept : ${acceptValue}`

	]

	socket.write(responseHeaders.concat('\r\n')/join('\r\n'));





	socket.on('data', (buffer) => {
		this.emit('data', parseFrame(buffer))
})


server.on('close', () => {

	console.log('closing...', socket);
	socket.destroy();


});
});

function generateAcceptValue(acceptKeys) {

	ID =   '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

	return crypto
		.createHash('sha1')
		.update(acceptKeys +ID ,'binary')
		.digest('base64')
}


function parseFrame(buffer) {
	this.OPCODES = {text : 0x01, close : 0x80}
	const firstByte = buffer.readUInt8(0);
	const opCodes = firstByte & 0b00001111;

	if(opCodes === this.OPCODES.close){
		this.emit('close')
		return null;
	}
	else if (opCodes !== this.OPCODES.text){
		return ;

	}
	const secondByte = buffer.readUInt(1);
	let offset = 2

	let payload_length = secondByte & 0b01111111;


	if(payload_length === 126)
		offset += 2;
	else if (payload_length === 127)
		offset += 8;

	const isMasked = Boolean((secondByte >>> 7) & 0b00000001);

	if(isMasked){
		const maskingKey = buffer.readUInt32BE(offset);
		offset += 4;
		const payload = buffer.subarray(offset);
		const result = unmask(payload,maskingKey);
		
		return result.toString('utf-8')

	}
	return result.subarray(offset).toString('utf-8')

}

function unmask(payload, maskingKey) {

	const result = Buffer.alloc(payload.byteLength);

	for (let i = 0; i< payload.byteLength;i++) {
			const j = i % 4;
			const maskingKeyByteShift = j === 3 ? 0 : (3 - j) << 3;
			const maskingKeyByte = (maskingKeyByteShift === 0 ? maskingKey : maskingKey >>> maskingKeyByteShift) & 0b11111111;
			const transfromedByte = maskingKeyByte ^ payload.readUInt(i);
			result.writeInt8(transfromedByte,i);
	}
	return result;
}


const Port = 4000;


server.on('data', (message) => {

	if(!message)
		return;

	const data = JSON.parse(message);
	console.log("Message recieved : " ,data);

})

server.listen(() => {

	console.log(`Websocket server listening on port ${Port}`);

})
