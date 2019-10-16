const connector = require ('./common/mq-connector');
const { QUEUE_NAME, EXCHANGE_MODE, EXCHANGE_NAME, EXCHANGE_KEYS } = require('./config');
const fs = require('fs');

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
    // channel.assertExchange(
    //     EXCHANGE_NAME, 
    //     EXCHANGE_MODE,
    //     { durable: true }
    // );

    // channel.qos(2, true);

    // let count = 0;
    // let loop = setInterval(() => {
    //     // channel.publish(
    //     //     EXCHANGE_NAME,
    //     //     // EXCHANGE_KEYS[count%EXCHANGE_KEYS.length], // roundrobin // '' =  broadcast
    //     //     Buffer.from(">>>>>>>>>>>>>>Hello World "+count++),
    //     //     {
    //     //         persistent: true // tells rabbitmq to save evry message on disk /!\ not 100% guaranty, see https://www.rabbitmq.com/confirms.html
    //     //         // so if then broker goes down, the queues unread values are kept (~)
    //     //     }
    //     // )
    //     channel.publish(EXCHANGE_NAME, '', Buffer.from("TO EVERYONE "+count++), { persistent: true });
    //     channel.publish(EXCHANGE_NAME, 'logs.info', Buffer.from("info "+count++), { persistent: true });
    //     channel.publish(EXCHANGE_NAME, 'logs.warning', Buffer.from("warning "+count++), { persistent: true });
    //     channel.publish(EXCHANGE_NAME, 'logs.error', Buffer.from("error "+count++), { persistent: true });
    //     channel.publish(EXCHANGE_NAME, 'logs.error.critical', Buffer.from("CRITICAL "+count++), { persistent: true });
    //     console.log(count);

    //     // console.log("> "+count+" > "+EXCHANGE_KEYS[count%EXCHANGE_KEYS.length]);
    // }, 500);

    let loop;
    let messageNotAcked = [];

    const startRoutine = async () => {
        try{
            const connection = await connector.getConnection();
            const channel = await connection.createConfirmChannel();
            // channel.qos(1, true);
            channel.assertExchange(
                EXCHANGE_NAME, 
                EXCHANGE_MODE,
                { durable: true }
            );
            connection.on('error', borkerErrorHandler);
            channel.on('error', borkerErrorHandler);

            if(!!Object.keys(messageUnAckHistory).length){
                Object.keys(messageUnAckHistory).forEach(key => {
                    resendSave(messageUnAckHistory[key]);
                    //TODO, we need add data (topic and exchanges)
                });
                if(!!Object.keys(messageUnAckHistory).length){
                    console.log(`Some unAck messages haven't been sent.`)
                    retryRoutine();
                }
            }

            loop = startMessageLoop(channel);
            // connection.on('return', res => {
            //     console.log('RETURN');
            //     console.log(res);
            // });
            // channel.on('return', res => {
            //     console.log('RETURN');
            //     console.log(res);
            // });
            // connection.on('ack', res => {
            //     console.log('ACK');
            //     console.log(res);
            // });
            // channel.on('ack', res => {
            //     console.log('ACK');
            //     console.log(res);
            // });
        }catch(e){
            retryRoutine();
        }
    }

    const borkerErrorHandler = err => {
        console.log(`Broker conenction error : "${err && err.message}"`);
        // console.log(err);
        retryRoutine(/*loop*/);
    }

    /** @return loop */
    const retryRoutine = async (/*loop = undefined*/) => {
        console.log('Connection to broker lost. Will retry in 5 sec...');
        // console.log(messageUnAckHistory);
        // loop && stopMessageLoop(loop);
        stopMessageLoop();
        await setTimeout(() => {
            startRoutine();
        }, 5000);
    }


    const types = {
        BROADCAST: 'broadcast',
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error',
        CRITICAL: 'critical',
    }
    const topic = {
        [types.BROADCAST]: 'logs',
        [types.INFO]: 'logs.info',
        [types.WARNING]: 'logs.warning',
        [types.ERROR]: 'logs.error',
        [types.CRITICAL]: 'logs.error.critical',
    };
    const typeArray = Object.keys(types);
    const defaultMessageType = typeArray[0];

    const resendSave = (channel, save) => {
        const tmp = save.buffer.toJSON();
        console.log(tmp);
        console.log(`RESEND: ${save.topic}`);
        channel.publish(save.exchange, save.topic, save.buffer, { 
            persistent: true,
            mandatory: true,
        }, (err, ok) => {
            if(!!err){
                reject(err);
            }else{
                ack(count);
                resolve(ok);
            }
        });
    }

    const sendMessage = (channel, { type = defaultMessageType, count, reset }) => {
        return new Promise((resolve, reject) => {
            const messageBuffer = Buffer.from(JSON.stringify({
                message: `${type} ${count}`,
                type,
                count,
                reset,
            }));

            saveForAck(count, {
                exchange: EXCHANGE_NAME,
                topic: topic[type],
                buffer: messageBuffer,
            });
            console.log(`PUB   > ${count} => ${type}:${topic[type]}`);
            channel.publish(EXCHANGE_NAME, topic[type], messageBuffer, { 
                persistent: true,
                mandatory: true,
            }, (err, ok) => {
                if(!!err){
                    !err.message && (err.message = "publish rejected");
                    reject(err);
                }else{
                    ack(count);
                    resolve(ok);
                }
            });
        });
    }

    let messageUnAckHistory = {};
    const ack = count => {
        if(!!messageUnAckHistory[count]){
            console.log(`ACK   > ${count}`);
            delete messageUnAckHistory[count];
        }else{
            console.log(`ERROR try to ack a message that has never been sent... : id: ${count}`);
        }
    }
    const saveForAck = (count, save) => {
        if(!messageUnAckHistory[count]){
            messageUnAckHistory[count] = save;
        }else{
            console.log(`ERROR to save message for ack but id already saved... : id: ${count}`);
        }
    }

    /** @return loop */
    const startMessageLoop = (channel) => {
        let count = 0;
        let reset = true;
        return setInterval(async () => {
            try{
                await sendMessage(channel, {
                    type: types.BROADCAST,
                    count: count++,
                    reset,
                });
                await sendMessage(channel, {
                    type: types.INFO,
                    count: count++,
                    reset,
                });
                await sendMessage(channel, {
                    type: types.WARNING,
                    count: count++,
                    reset,
                });
                await sendMessage(channel, {
                    type: types.ERROR,
                    count: count++,
                    reset,
                });
                await sendMessage(channel, {
                    type: types.CRITICAL,
                    count: count++,
                    reset,
                });
                reset = false;
            }catch(err){
                borkerErrorHandler();
            }
        }, 10);
    }

    const stopMessageLoop = (/*loop*/) => {
        return !!loop && clearInterval(loop);
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