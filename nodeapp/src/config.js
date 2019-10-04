module.exports = {
    QUEUE_NAME: 'test-queue',
    EXCHANGE_NAME: 'test-exchnage',
    // fanout = take all message pruced and send them to all subscribers
    // direct = use binding key, you can select the message type you want by queue
    // topic = like mqtt (* = 1 word) (# = multiple words) (words are separated by ".") (max 255 bytes)
    EXCHANGE_MODE: 'topic', 
    EXCHANGE_KEYS: [ // for direct demo
        'info',
        'warning',
        'error',
        //'', // broadcast
    ],
    MQ: {
        MQ_USER: 'test',
        MQ_PASS: '1234',
        MQ_HOST: '192.168.99.100', // if windows10Pro or OSX or UNIX => 127.0.0.1
        MQ_PORT: '5672',
    }
}