const config = require('./config')
const { getPort, releasePort } = require('./Port')
const recordclient = require('node-rest-client').Client
const { v4: uuidv4 } = require('uuid')

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

  unpublishRtpStream(socket_id, transport_id) {
    let rtpConsumerId = this.peers.get(socket_id).record_consumer_ids.get(transport_id)
    this.peers.get(socket_id).closeConsumer(rtpConsumerId)
    this.peers.get(socket_id).removeTransport(transport_id)
    let rtpPort = this.peers.get(socket_id).getRecordRTPPort(transport_id)
    let rtcpPort = this.peers.get(socket_id).getRecordRTCPPort(transport_id)
    releasePort(rtpPort)
    releasePort(rtcpPort)
    this.peers.get(socket_id).removeRecordRTPPort(transport_id)
    this.peers.get(socket_id).removeRecordRTCPPort(transport_id)
  }
  
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
	  
    this.peers.get(socket_id).addTransport(rtpTransport)
    this.peers.get(socket_id).addRecordTransportId(rtpTransport.id)
    this.peers.get(socket_id).addRecordRTPPort(rtpTransport.id, rtpPort)
    this.peers.get(socket_id).addRecordRTCPPort(rtpTransport.id, rtcpPort)

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
    /*
    console.log({
	    producerId: producer.id,
	    rtpCapabilities
    })
    const rtpConsumer = await rtpTransport.consume({
	    producerId: producer.id,
	    rtpCapabilities
    })
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
    let { consumer, params } = await this.peers.get(socket_id).createConsumer(rtpTransport.id, producer.id, rtpCapabilities)
    consumer.on(
	    'producerclose',
	    async function () {
		    console.log('Consumer closed due to producerclose event for Recording', {
			name: `${this.peers.get(socket_id).name}`,
			consumer_id: `${consumer.id}`
		    })
		    
		    if (this.peers.get(socket_id).getRecordId() != '') {
		      console.log("stopRecord due to producer close")
		      await this.stopRecord(socket_id) 
		    }
		    /*
		    this.peers.get(socket_id).record_consumer_ids.forEach(function(consumer_id, transport_id) {
		      if(consumer_id === consumer.id) {
		        console.log("remove rtp rtcp port based on transport_id[" + transport_id + "]")
			this.peers.get(socket_id).removeRecordRTPPort(transport_id)
	 		this.peers.get(socket_id).removeRecordPTCPPort(transport_id)
			break
		    })
		    */
		    this.peers.get(socket_id).removeConsumer(consumer.id)
		    this.io.to(socket_id).emit('consumerClosed', {
			consumer_id: consumer.id
		    })

	    }.bind(this)
    )
    this.peers.get(socket_id).addRecordConsumerId(rtpTransport.id, consumer.id)
	 
   console.log({
     "params": params
   })
   return params 
  }


  beginRecord(params) {
    return new Promise(resolve => {
      //const rtpTransport = await this.router.createPlainTransport(config.mediasoup.plainRtpTransport)


      this.client.post("http://" + config.mediasoup.recorderInfo.Ip + ":" + config.mediasoup.recorderInfo.Port + "/StartRecord", params, (data,response)=> {
        resolve(data)
      })
    })
  }
	
  endRecord(params) {
    return new Promise(resolve => {
      this.client.post("http://" + config.mediasoup.recorderInfo.Ip + ":" + config.mediasoup.recorderInfo.Port + "/StopRecord", params, (data,response)=> {
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
            "id": this.peers.get(socket_id).getRecordId() 
          }
        }
	
        console.log("send end record")
	console.log(params)
	

        let res = await this.endRecord(params)
        if (res.code == "success") {
          console.log("stopping recording")

	  this.peers.get(socket_id).record_transport_ids.forEach(function(transport_id) {
            console.log("unpublish rtp stream.")
	    this.unpublishRtpStream(socket_id, transport_id) 
	  }, this)
	
	  this.peers.get(socket_id).clearRecordConsumerId()
	  this.peers.get(socket_id).clearRecordTransportId()

          console.log("stopped recording")
	  		
        } else {
	  console.log("-----------------")
          console.log(res.reason)
        }

	
        this.io.to(socket_id).emit('stoppedRecord', {
	  record_id: this.peers.get(socket_id).getRecordId(),
	  record_path: "/record/" + this.peers.get(socket_id).getRecordId() + ".webm"
	})
        this.peers.get(socket_id).setRecordId('')
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

    this.peers.get(socket_id).setRecordId(uuidv4())
    try {
      if (useVideo && useAudio) {

        let video_ports = await getPort()
	let audio_ports = await getPort()
	let params = {
	  headers: {
	    "Content-Type": "application/json"
          },
          data: {
            "id": this.peers.get(socket_id).getRecordId(),
            "name": this.peers.get(socket_id).getRecordId(),
            "path": "/home/centos/workspace/mediasoup-videoroom-record/public/record",
            "video": {
              "codec": "VP8",
	      "rtp_port": video_ports.rtp_port,
	      "rtcp_port": video_ports.rtcp_port
	    },
	    "audio": {
	      "codec": "OPUS",
	      "rtp_port": audio_ports.rtp_port,
	      "rtcp_port": audio_ports.rtcp_port
	    }
	  }
	}
	console.log(params)

	let res = await this.beginRecord(params)
	if (res.code == "success") {
	  console.log("starting recording with audio and video")
          await this.publishRtpStream(socket_id, audioProducer, config.mediasoup.recorderInfo.Ip, audio_ports.rtp_port, audio_ports.rtcp_port)
          await this.publishRtpStream(socket_id, videoProducer, config.mediasoup.recorderInfo.Ip, video_ports.rtp_port, video_ports.rtcp_port)
          console.log("started recording with audio and video")
        } else {
	  releasePort(video_ports.rtp_port)
          releasePort(video_ports.rtcp_port)
	  releasePort(audio_ports.rtp_port)
          releasePort(audio_ports.rtcp_port)
          console.log(res.reason)
        }

      } else if (useVideo) {

	let ports = await getPort()
	let params = {
	  headers: { 
	    "Content-Type": "application/json"
	  },
	  data: {
            "id": this.peers.get(socket_id).getRecordId(),
	    "name": this.peers.get(socket_id).getRecordId(),
            "path": "/home/centos/workspace/mediasoup-videoroom-record/public/record",
	    "video": {
              "codec": "VP8",
              "rtp_port": ports.rtp_port,
              "rtcp_port": ports.rtcp_port 
            }
	  }
	}
	console.log(params)

	let res = await this.beginRecord(params) 
	if (res.code == "success") {
          console.log("starting recording video only")
          await this.publishRtpStream(socket_id, videoProducer, config.mediasoup.recorderInfo.Ip, ports.rtp_port, ports.rtcp_port)
	  console.log("started recording video only")
	} else {
	  releasePort(ports.rtp_port)
	  releasePort(ports.rtcp_port)
	  console.log(res.reason)
	}

      } else if (useAudio) {

        let ports = await getPort()
	let params = {
	  headers: {
            "Content-Type": "application/json"
	  },
          data: {
            "id": this.peers.get(socket_id).getRecordId(),
            "name": this.peers.get(socket_id).getRecordId(),
            "path": "/home/centos/workspace/mediasoup-videoroom-record/public/record",
            "audio": {
              "codec": "OPUS",
              "rtp_port": ports.rtp_port,
              "rtcp_port": ports.rtcp_port
            }
          }
        }
	console.log(params)

	let res = await this.beginRecord(params)
	if (res.code == "success") {
	  console.log("starting recording audio only")
          await this.publishRtpStream(socket_id, audioProducer, config.mediasoup.recorderInfo.Ip, ports.rtp_port, ports.rtcp_port)
          console.log("started recording audio only")
        } else {
	   releasePort(ports.rtp_port)
	   releasePort(ports.rtcp_port)
	   console.log(res.reason)
	}

      } else {
        this.peers.get(socket_id).setRecordId('')
      }
    } catch (error) {
      console.log(error)
      this.peers.get(socket_id).setRecordId('')
    }

    if(this.peers.get(socket_id).getRecordId() != '') {
        this.io.to(socket_id).emit('startedRecord', {
	  record_id: this.peers.get(socket_id).getRecordId(),
          record_path: "/record/" + this.peers.get(socket_id).getRecordId() + ".webm"
	})
        //this.peers.get(socket_id).setRecordId('')
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
