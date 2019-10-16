const connector = require ('./common/mq-connector');
const { QUEUE_NAME, EXCHANGE_MODE, EXCHANGE_NAME, EXCHANGE_KEYS } = require('./config');
const subscriberId = process.argv[2];


const topicsTest = [
    "#", "logs.info.#", "logs.warning.#", "logs.error.#"
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
    // // create exchange if not exists
    // // channel.assertExchange( //assume it's created by the publisher
    // //     EXCHANGE_NAME, 
    // //     EXCHANGE_MODE,
    // //     { durable: true }
    // // );

    // // create subscriber queue and get its ref (cause we don't know its name)
    // const q = await channel.assertQueue(
    //     // '', // will generate a random queue name
    //     !!subscriberId ? 'subscriber-'+subscriberId : '',
    //     {
    //         exclusive: !subscriberId, // (true) delete queue when connection closed
    //         durable: true,
    //         //durable = true by default to keep queue when rabbitmq is down
    //     }
    // );

    // // channel.prefetch(1);

    // // bind the new temps queue to the exchange
    // channel.bindQueue(
    //     q.queue, 
    //     EXCHANGE_NAME, 
    //     exchangeKey // ''
    // );

    // // then we can consume the queue normaly

    // channel.consume(q.queue, res => {
    //     console.log(exchangeKey+"  "+res.content.toString());
    //     channel.ack(res);
    // },{
    //     noAck: false
    // });
    // // setInterval(() => {
    // //     console.log(Date.now());
    // // }, 1000);

    let prevCounts = {}
    const startRoutine = async () => {
        try{
            const connection = await connector.getConnection();
            const channel = await connection.createChannel();

            const q = await channel.assertQueue(
                // '', // will generate a random queue name
                !!subscriberId ? 'subscriber-'+subscriberId : '',
                {
                    exclusive: !subscriberId, // (true) delete queue when connection closed
                    durable: true,
                    //durable = true by default to keep queue when rabbitmq is down
                }
            );

            channel.bindQueue(
                q.queue, 
                EXCHANGE_NAME, 
                exchangeKey // ''
            );

            connection.on('error', err =>  { // connection, not channel
                console.log(`Broker conenction error : "${err.message}"`);
                // console.log(err);
                retryRoutine();
            });
            channel.on('error', err =>  { // connection, not channel
                console.log(`Broker conenction error : "${err.message}"`);
                // console.log(err);
                retryRoutine();
            });

            
            channel.consume(q.queue, res => {
                const data = JSON.parse(res.content);

                // if counters not init, or receive a new init
                // if(!prevCounts[data.type] || data.reset){
                //     prevCounts[data.type] = -1;
                // }
                // if one data skipped
                if(data.count < prevCounts[data.type]+1 && !data.reset){
                    console.log(`EXPECTED [${data.type}]:  [${prevCounts[data.type]+1}] RECEIVED [${data.count}]`);
                    process.exit(1)
                }else{
                    prevCounts[data.type] = data.count;
                }

                console.log((data.reset?"[RESET] ":"")+exchangeKey+"  "+data.message);
                channel.ack(res);
            },{
                noAck: false
            }, (err, ok)=> {
                if(err !== null){
                    console.log("ERROR HANDLING");
                    retryRoutine();
                }
            });
            
        }catch(e){
            retryRoutine();
        }
    }

    const retryRoutine = async () => {
        console.log('Connection to broker lost. Will retry in 5 sec...');
        await setTimeout(() => {
            startRoutine();
        }, 5000);
    }

    startRoutine();

}

const main = async () => {
    // const connection = await connector.getConnection();
    // const channel = await connection.createChannel();

    // demoWorkQueue(channel);
    demoPubSub(/*channel*/);
}

main();