const connector = require ('./common/mq-connector');
const { QUEUE_NAME, EXCHANGE_MODE, EXCHANGE_NAME, EXCHANGE_KEYS } = require('./config');

const demoWorkQueue = async channel => {
    channel.assertQueue(QUEUE_NAME, {
        durable: true // to keep queue when rabbitmq is down
    });
    let count = 0;
    setInterval(() => {
        channel.sendToQueue(
            QUEUE_NAME, 
            Buffer.from(">>>>>>>>>>>>>>Hello World "+count++),
            {
                persistent: true // tells rabbitmq to save evry message on disk /!\ not 100% guaranty, see https://www.rabbitmq.com/confirms.html
            }
        );
    }, 500);
}

const demoPubSub = async channel => {
    // create exchange if not exists
    channel.assertExchange(
        EXCHANGE_NAME, 
        EXCHANGE_MODE,
        { durable: true }
    );

    let count = 0;
    setInterval(() => {
        // channel.publish(
        //     EXCHANGE_NAME,
        //     // EXCHANGE_KEYS[count%EXCHANGE_KEYS.length], // roundrobin // '' =  broadcast
        //     Buffer.from(">>>>>>>>>>>>>>Hello World "+count++),
        //     {
        //         persistent: true // tells rabbitmq to save evry message on disk /!\ not 100% guaranty, see https://www.rabbitmq.com/confirms.html
        //         // so if then broken goes down, the queues unread values are kept (~)
        //     }
        // )
        channel.publish(EXCHANGE_NAME, '', Buffer.from("TO EVERYONE "+count++));
        channel.publish(EXCHANGE_NAME, 'logs.info', Buffer.from("info "+count++));
        channel.publish(EXCHANGE_NAME, 'logs.warning', Buffer.from("warning "+count++));
        channel.publish(EXCHANGE_NAME, 'logs.error', Buffer.from("error "+count++));
        channel.publish(EXCHANGE_NAME, 'logs.error.critical', Buffer.from("CRITICAL "+count++));
        console.log(count);

        // console.log("> "+count+" > "+EXCHANGE_KEYS[count%EXCHANGE_KEYS.length]);
    }, 500);
}

const main = async () => {
    const connection = await connector.getConnection();
    const channel = await connection.createChannel();

    // demoWorkQueue(channel);
    demoPubSub(channel);
}

main();