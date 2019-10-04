const connector = require ('./common/mq-connector');
const { QUEUE_NAME, EXCHANGE_MODE, EXCHANGE_NAME, EXCHANGE_KEYS } = require('./config');
const subscriberId = process.argv[2];


const topicsTest = [
    "logs.#", "logs.info.#", "logs.warning.#", "logs.error.#"
];

const exchangeKey = topicsTest[subscriberId%topicsTest.length] || topicsTest[0];

const demoWorkQueue = async channel => {
    channel.assertQueue(QUEUE_NAME, {
        durable: true // to keep queue when rabbitmq is down
    });
    channel.prefetch(1); // tells rabbitmq to not send us more than 1 message a time. For a more relevent charge repartition when event have not the same processing time.

    channel.consume(QUEUE_NAME, res => {
        console.log(res.content.toString());
        channel.ack(res);
    },{
        noAck: false
    });
    setInterval(() => {
        console.log(Date.now());
    }, 100);
}

const demoPubSub = async channel => {
    // create exchange if not exists
    // channel.assertExchange( //assume it's created by the publisher
    //     EXCHANGE_NAME, 
    //     EXCHANGE_MODE,
    //     { durable: true }
    // );

    // create subscriber queue and get its ref (cause we don't know its name)
    const q = await channel.assertQueue(
        // '', // will generate a random queue name
        !!subscriberId ? 'subscriber-'+subscriberId : '',
        {
            exclusive: !subscriberId, // (true) delete queue when connection closed
            //durable = true by default to keep queue when rabbitmq is down
        }
    );

    // bind the new temps queue to the exchange
    channel.bindQueue(
        q.queue, 
        EXCHANGE_NAME, 
        exchangeKey // ''
    );

    // then we can consume the queue normaly
    channel.consume(q.queue, res => {
        console.log(exchangeKey+"  "+res.content.toString());
        channel.ack(res);
    },{
        noAck: false
    });
    // setInterval(() => {
    //     console.log(Date.now());
    // }, 1000);

}

const main = async () => {
    const connection = await connector.getConnection();
    const channel = await connection.createChannel();

    // demoWorkQueue(channel);
    demoPubSub(channel);
}

main();