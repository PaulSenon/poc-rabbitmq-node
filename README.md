# WHAT IS THIS ?

POC setting up a pub/sub pattern using rabbitMq and node

# INSTALL :

### before doing anything elese, you'll need : 

* docker
* docker-compose
* node (>8)
* (yarn) (`npm install -g yarn`)

### start (and stop) rabbitmq broker :

* start docker (if you're on windows/osx)
* run `docker-compose up` (anytime use `docker-compose down` if Ctrl+C doens't kill everything)

> the broker address will be `amqp://{MQ_USER}:{MQ_PASS}@{MQ_HOST}:{MQ_PORT}`

by default : (you can change it in `docker-compose.yml`, also used in js through `src/config.js`)

* `MQ_USER` = 'test' 
* `MQ_PASS` = '1234' 
* `MQ_HOST` = '127.0.0.1' (or `192.168.99.100` on windows if not `Windows 10 Pro`)
* `MQ_PORT`: '5672' 

### use node pub/sub demo scripts :

* go in `src/` (`cd src`)
* run `yarn` (or `npm i`)

> two yarn aliases are defined to run publisher and subscriber scripts

* `yarn sub` will start a new subscriber, with a new temp queue (deleted when disconnected)

* `yarn sub {id}` will start a new subscriber, with a named queue (from the id) => this way the queue is dirable, and you can connect multiple subs to the same queue.   

* `yarn pub` will start a new publisher that will publish some messages for all subscribers

> you can run `1` publisher and `n` subscribers