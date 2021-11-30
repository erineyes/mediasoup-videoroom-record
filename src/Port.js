const MIN_PORT = 20000;
const MAX_PORT = 30000;
const TIMEOUT = 400;

const takenPortSet = new Set();

module.exports.getPort = async () => {
  let port = getRandomPort();
  let port2 = port + 1
  while(takenPortSet.has(port) || takenPortSet.has(port2)) {
    port = getRandomPort();
    port2 = port + 1 
    try {
      await isPortOpen(port);
    } catch (error) {
      console.error('getPort() port is taken [port:%d]', port);
      takenPortSet.add(port);
    }

    try {
      await isPortOpen(port2);
    } catch (error) {
      console.error('getPort() port2 is taken [port2:%d]', port2);
      takenPortSet.add(port2);
    }
  }
  takenPortSet.add(port);
  takenPortSet.add(port2);
  return { 
	"rtp_port": port, 
	"rtcp_port": port2
  };
};

module.exports.releasePort = (port) => {
  console.log("release port[" + port + "]")
  takenPortSet.delete(port);
}

const getRandomPort = () => Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT); 

const isPortOpen = (port) => {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve); 
		      
    socket.setTimeout(TIMEOUT);
    socket.once('timeout', () => reject);
    socket.once('error', (error) => reject());

    socket.connect(port, '127.0.0.1');
  });
};
