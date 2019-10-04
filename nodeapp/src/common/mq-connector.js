const amqp = require ('amqplib');
const { MQ_USER, MQ_PASS, MQ_HOST, MQ_PORT } = require('../config').MQ;


class MqConnector {

    /**
     * @return Promise
     */
    getConnection(){
        return amqp.connect(`amqp://${MQ_USER}:${MQ_PASS}@${MQ_HOST}:${MQ_PORT}`);
    }
}

module.exports = new MqConnector();