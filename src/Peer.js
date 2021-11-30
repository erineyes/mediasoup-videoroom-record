module.exports = class Peer {
  constructor(socket_id, name) {
    this.id = socket_id
    this.name = name
    this.transports = new Map()
    this.consumers = new Map()
    this.producers = new Map()
    this.record_id = ''
    this.record_transport_ids = [] 
    this.record_consumer_ids = new Map()
    this.record_rtp_ports = new Map()
    this.record_rtcp_ports = new Map()
  }

  setRecordId(id) {
    this.record_id = id
  }	

  getRecordId() {
    return this.record_id
  }

  addRecordRTPPort(transport_id, port_number) {
    this.record_rtp_ports.set(transport_id, port_number)
  }

  addRecordRTCPPort(transport_id, port_number) {
    this.record_rtcp_ports.set(transport_id, port_number)
  }

  getRecordRTPPort(transport_id) {
    return this.record_rtp_ports.get(transport_id)
  }
	
  getRecordRTCPPort(transport_id) {
    return this.record_rtcp_ports.get(transport_id)
  }

  removeRecordRTPPort(transport_id) {
    this.record_rtp_ports.delete(transport_id)
  }

  removeRecordRTCPPort(transport_id) {
    this.record_rtcp_ports.delete(transport_id)
  }

  clearRecordPort() {
    this.record_rtp_ports.length = 0
    this.record_rtcp_ports.length = 0
  }

  addRecordTransportId(transport_id) {
    this.record_transport_ids.push(transport_id)
  }

  addRecordConsumerId(transport_id, consumer_id) {
    this.record_consumer_ids.set(transport_id, consumer_id)
  }

  clearRecordTransportId() {
    this.record_transport_ids.length = 0 
  }

  clearRecordConsumerId() {
    this.record_consumer_ids.clear()
  }
  
  removeTransport(transport_id) {
    let transport = this.transports.get(transport_id)

    try {
      transport.close()
    } catch (error) {
      console.error('Transport close failed', error)
      return
    }

    this.transports.delete(transport_id)
  }

  closeConsumer(consumer_id) {
    try {
      console.log('close consumer[' + this.consumers.get(consumer_id).kind + ']')
      this.consumers.get(consumer_id).close()
    } catch (e) {
      console.warn(e)
    }

    this.consumers.delete(consumer_id)
  }


  ///////////////////////////////////////////////////////////
  
  addTransport(transport) {
    this.transports.set(transport.id, transport)
  }

  async connectTransport(transport_id, dtlsParameters) {
    if (!this.transports.has(transport_id)) return

    await this.transports.get(transport_id).connect({
      dtlsParameters: dtlsParameters
    })
  }

  async createProducer(producerTransportId, rtpParameters, kind) {
    //TODO handle null errors
    let producer = await this.transports.get(producerTransportId).produce({
      kind,
      rtpParameters
    })

    this.producers.set(producer.id, producer)

    producer.on(
      'transportclose',
      function () {
        console.log('Producer transport close', { name: `${this.name}`, consumer_id: `${producer.id}` })
        producer.close()
        this.producers.delete(producer.id)
      }.bind(this)
    )

    return producer
  }

  async createConsumer(consumer_transport_id, producer_id, rtpCapabilities) {
    let consumerTransport = this.transports.get(consumer_transport_id)

    let consumer = null
    try {
      consumer = await consumerTransport.consume({
        producerId: producer_id,
        rtpCapabilities,
        paused: false //producer.kind === 'video',
      })
    } catch (error) {
      console.error('Consume failed', error)
      return
    }

    /*
    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({
        spatialLayer: 2,
        temporalLayer: 2
      })
    }
    */

    this.consumers.set(consumer.id, consumer)

    
    consumer.on(
      'transportclose',
      function () {
        console.log('close consumer[' + this.consumers.get(consumer_id).kind + ']')
        console.log('Consumer transport close', { name: `${this.name}`, consumer_id: `${consumer.id}` })
        this.consumers.delete(consumer.id)
      }.bind(this)
    )

    return {
      consumer,
      params: {
        producerId: producer_id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      }
    }
  }

  closeProducer(producer_id) {
    try {
      this.producers.get(producer_id).close()
    } catch (e) {
      console.warn(e)
    }

    this.producers.delete(producer_id)
  }

  getProducer(producer_id) {
    return this.producers.get(producer_id)
  }

  close() {
    this.transports.forEach((transport) => transport.close())
  }

  removeConsumer(consumer_id) {
    this.consumers.delete(consumer_id)
  }
}
