const config = require('./config')
const recordclient = require('node-rest-client').Client;

module.exports = class Room {
  constructor(room_id, worker, io) {
    this.id = room_id
    const mediaCodecs = config.mediasoup.router.mediaCodecs
    worker
      .createRouter({
        mediaCodecs
      })
      .then(
        function (router) {
          this.router = router
        }.bind(this)
      )

    this.peers = new Map()
    this.io = io
    this.client = new recordclient()
    this.recorderIp = "3.37.52.70"
  }

  addPeer(peer) {
    this.peers.set(peer.id, peer)
  }

  getProducerListForPeer() {
    let producerList = []
    this.peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push({
          producer_id: producer.id
        })
      })
    })
    return producerList
  }

  getRtpCapabilities() {
    return this.router.rtpCapabilities
  }
  
  /*
  async startRecord(socket_id) {
    let producers = this.peers.get(socket_id).producers
    let params = {}
    for(const producer of producers) {
      params = await publishRtpStream(socket_id, producer, 50000, 50001)
    }
    return params
  }
  */

  async publishRtpStream(socket_id, producer, recorderIp, rtpPort, rtcpPort) {
    const rtpTransport = await this.router.createPlainTransport(config.mediasoup.plainRtpTransport)
    console.log({
	    ip: recorderIp,
	    port: rtpPort,
    	    rtcpPort: rtcpPort
    })

    await rtpTransport.connect({
	    ip: recorderIp,
	    port: rtpPort,
    	    rtcpPort: rtcpPort
    })

    console.log(
      "mediasoup RTP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.tuple.localIp,
      rtpTransport.tuple.localPort,
      rtpTransport.tuple.remoteIp,
      rtpTransport.tuple.remotePort,
      rtpTransport.tuple.protocol
    );

    console.log(
      "mediasoup RTCP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.rtcpTuple.localIp,
      rtpTransport.rtcpTuple.localPort,
      rtpTransport.rtcpTuple.remoteIp,
      rtpTransport.rtcpTuple.remotePort,
      rtpTransport.rtcpTuple.protocol
    );
	  
    console.log('Adding plain transport', { transportId: rtpTransport.id })
    this.peers.get(socket_id).addTransport(rtpTransport)

    const codecs = []
    const routerCodec = this.router.rtpCapabilities.codecs.find(
	    codec => codec.kind === producer.kind
    )
    /* 
    console.log({
      'codecs': routerCodec 
    })
    */
    codecs.push(routerCodec)

    const rtpCapabilities = {
	    codecs,
	    rtcpFeedback: []
    }

    console.log({
	    producerId: producer.id,
	    rtpCapabilities
    })

    const rtpConsumer = await rtpTransport.consume({
	    producerId: producer.id,
	    rtpCapabilities
    })

    /*
    console.log({
      'rtpConsumer': rtpConsumer
    })
   
    console.log({
      'rtpConsumer.kind': rtpConsumer.kind
    })
	  
    console.log({
      'rtpConsumer.rtpParameters': rtpConsumer.rtpParameters
    })

    console.log({
      'rtpConsumer.rtpParameters.codecs': rtpConsumer.rtpParameters.codecs
    })

    console.log({
      'rtpConsumer.rtpParameters.codecs.rtcpFeedback': rtpConsumer.rtpParameters.codecs.rtcpFeedback
    })

    console.log({
      'rtpConsumer.rtpParameters.encodings': rtpConsumer.rtpParameters.encodings
    })

    console.log({
      'rtpConsumer.type': rtpConsumer.type
    })
    */
    /*
    let { consumer, params } = await this.peers.get(socket_id).createConsumer(rtpTransport.id, producer.id, rtpCapabilities)
    consumer.on(
	    'producerclose',
	    function () {
		    console.log('Consumer closed due to producerclose event for Recording', {
			name: `${this.peers.get(socket_id).name}`,
			consumer_id: `${consumer.id}`
		    })
		    this.peers.get(socket_id).removeConsumer(consumer.id)
		    this.io.to(socket_id).emit('consumerClosed for Recording', {
			consumer_id: consumer.id
		    })
	    }.bind(this)
    )
   console.log({
     "params": params
   })
   return params 
   */
   
    return {
      params: {
        id: rtpTransport.id
      }
    }
  }


  beginRecord(params) {
    return new Promise(resolve => {
      this.client.post("http://" + this.recorderIp + ":8080/StartRecord", params, (data,response)=> {
        resolve(data)
      })
    })
  }
	
  endRecord(params) {
    return new Promise(resolve => {
      this.client.post("http://" + this.recorderIp + ":8080/StopRecord", params, (data,response)=> {
        resolve(data)
      })
    })
  }

  async stopRecord(socket_id) {
        let params = {
          headers: {
            "Content-Type": "application/json"
          },
          data: {
            "id": "test"
          }
        }

        let res = await this.endRecord(params)
        if (res.code == "success") {
          console.log("stopping recording...")
          //await this.unpublishRtpStream(socket_id, videoProducer, this.recorderIp, 50000, 50001)
          console.log("stopped recording...")
        } else {
          console.log("--------")
          console.log(res.reason)
          console.log("--------")
        }

  }

  async startRecord(socket_id) {
    let producers = Array.from(this.peers.get(socket_id).producers.values())
    let useVideo = false
    let useAudio = false
    let videoProducer = null
    let audioProducer = null
    for(const producer of producers) {
      try {
	if (producer.kind == "video") {
	  useVideo = true
	  videoProducer = producer
	} else if (producer.kind == "audio") {
	  useAudio = true
	  audioProducer = producer
	}
        //await this.publishRtpStream(socket_id, producer, 50000, 50001)
      } catch (error) {
        console.log(error)
      }
    }
    
    try {
      if (useVideo && useAudio) {


      } else if (useVideo) {

	let params = {
	  headers: { 
	    "Content-Type": "application/json"
	  },
	  data: {
	    "id": "test",
	    "name": "testName",
	    "path": "/home/centos/workspace/pulsar/out",
	    "video": {
              "codec": "VP8",
              "rtp_port": 50000,
              "rtcp_port": 50001
            }
	  }
	}

	let res = await this.beginRecord(params) 
	if (res.code == "success") {
          console.log("starting recording...")
          await this.publishRtpStream(socket_id, videoProducer, this.recorderIp, 50000, 50001)
	  console.log("started recording...")
	} else {
	  console.log("--------")
	  console.log(res.reason)
	  console.log("--------")
	}

	

      } else if (useAudio) {


      } else {


      }

    } catch (error) {
      console.log(error)
    }
     
  }

  async createWebRtcTransport(socket_id) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate
    })
    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate)
      } catch (error) {}
    }

    transport.on(
      'dtlsstatechange',
      function (dtlsState) {
        if (dtlsState === 'closed') {
          console.log('Transport close', { name: this.peers.get(socket_id).name })
          transport.close()
        }
      }.bind(this)
    )

    transport.on('close', () => {
      console.log('Transport close', { name: this.peers.get(socket_id).name })
    })

    console.log('Adding transport', { transportId: transport.id })
    this.peers.get(socket_id).addTransport(transport)
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      }
    }
  }

  async connectPeerTransport(socket_id, transport_id, dtlsParameters) {
    if (!this.peers.has(socket_id)) return

    await this.peers.get(socket_id).connectTransport(transport_id, dtlsParameters)
  }

  async produce(socket_id, producerTransportId, rtpParameters, kind) {
    // handle undefined errors
    return new Promise(
      async function (resolve, reject) {
        let producer = await this.peers.get(socket_id).createProducer(producerTransportId, rtpParameters, kind)
        console.log("createProducer")
	console.log({
	  "producer": producer.id
	})
        resolve(producer.id)
        this.broadCast(socket_id, 'newProducers', [
          {
            producer_id: producer.id,
            producer_socket_id: socket_id
          }
        ])
      }.bind(this)
    )
  }

  async consume(socket_id, consumer_transport_id, producer_id, rtpCapabilities) {
    // handle nulls
    if (
      !this.router.canConsume({
        producerId: producer_id,
        rtpCapabilities
      })
    ) {
      console.error('can not consume')
      return
    }

    let { consumer, params } = await this.peers
      .get(socket_id)
      .createConsumer(consumer_transport_id, producer_id, rtpCapabilities)
    console.log("createConsumer")

    consumer.on(
      'producerclose',
      function () {
        console.log('Consumer closed due to producerclose event', {
          name: `${this.peers.get(socket_id).name}`,
          consumer_id: `${consumer.id}`
        })
        this.peers.get(socket_id).removeConsumer(consumer.id)
        // tell client consumer is dead
        this.io.to(socket_id).emit('consumerClosed', {
          consumer_id: consumer.id
        })
      }.bind(this)
    )

    return params
  }

  async removePeer(socket_id) {
    this.peers.get(socket_id).close()
    this.peers.delete(socket_id)
  }

  closeProducer(socket_id, producer_id) {
    this.peers.get(socket_id).closeProducer(producer_id)
  }

  broadCast(socket_id, name, data) {
    for (let otherID of Array.from(this.peers.keys()).filter((id) => id !== socket_id)) {
      this.send(otherID, name, data)
    }
  }

  send(socket_id, name, data) {
    this.io.to(socket_id).emit(name, data)
  }

  getPeers() {
    return this.peers
  }

  toJson() {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers])
    }
  }
}
