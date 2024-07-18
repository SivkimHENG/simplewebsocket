const http = require('node:http');
const { EventEmitter } = require('node:events');
const crypto = require('crypto');

const server = http.createServer((req, res) => {
  const UPGRADE_REQUIRE = 426;
  const body = http.STATUS_CODES[UPGRADE_REQUIRE];

  res.writeHead(UPGRADE_REQUIRE, {
    'Content-Type': 'text/plain',
    'Upgrade': 'WebSocket',
  });
  res.end(body);
});

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade.toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\n');
    return;
  }

  const acceptKey = req.headers['sec-websocket-key'];
  const acceptValue = generateAcceptValue(acceptKey);

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptValue}`
  ];

  socket.write(responseHeaders.concat('\r\n').join('\r\n') + '\r\n\r\n');

  socket.on('data', (buffer) => {
    const message = parseFrame(buffer);
    if (message !== null) {
      console.log('Received message:', message);
      const eventEmitter = new EventEmitter();
      eventEmitter.on('data', (data) => socket.write(createFrame(data)));
      eventEmitter.emit('data', message);
    }
  });

  socket.on('close', () => {
    console.log('Socket closed.');
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

function generateAcceptValue(acceptKey) {
  const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return crypto
    .createHash('sha1')
    .update(acceptKey + GUID, 'binary')
    .digest('base64');
}

function parseFrame(buffer) {
  const OPCODES = { text: 0x01, close: 0x08 };
  const firstByte = buffer.readUInt8(0);
  const opCode = firstByte & 0b00001111;

  if (opCode === OPCODES.close) {
    return null;
  } else if (opCode !== OPCODES.text) {
    return;
  }

  const secondByte = buffer.readUInt8(1);
  let offset = 2;

  let payloadLength = secondByte & 0b01111111;
  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const isMasked = (secondByte >>> 7) & 0b00000001;
  let payload;

  if (isMasked) {
    const maskingKey = buffer.readUInt32BE(offset);
    offset += 4;
    payload = buffer.slice(offset, offset + payloadLength);
    payload = unmask(payload, maskingKey);
  } else {
    payload = buffer.slice(offset, offset + payloadLength);
  }

  return payload.toString('utf-8');
}

function createFrame(data) {
  const payload = Buffer.from(data);
  const payloadByteLength = payload.length;
  let payloadBytesOffset = 2;
  let payloadLength = payloadByteLength;

  if (payloadByteLength > 65535) {
    payloadBytesOffset += 8;
    payloadLength = 127;
  } else if (payloadByteLength > 125) {
    payloadBytesOffset += 2;
    payloadLength = 126;
  }

  const buffer = Buffer.alloc(payloadBytesOffset + payloadByteLength);

  buffer.writeUInt8(0b10000001, 0);
  buffer[1] = payloadLength;

  if (payloadLength === 126) {
    buffer.writeUInt16BE(payloadByteLength, 2);
  } else if (payloadLength === 127) {
    buffer.writeBigUInt64BE(BigInt(payloadByteLength), 2);
  }

  buffer.set(payload, payloadBytesOffset);
  return buffer;
}

function unmask(payload, maskingKey) {
  const result = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    const j = i % 4;
    const maskingKeyByte = (maskingKey >>> (8 * (3 - j))) & 0xFF;
    result[i] = maskingKeyByte ^ payload[i];
  }
  return result;
}

const Port = 4000;

server.listen(Port, () => {
  console.log(`WebSocket server listening on port ${Port}`);
});

