const config = require("./config/config")

const logger = require("./lib/logger")
const rmqModule = require("./lib/rabbitmqModule")
const socketModule = require("./lib/websocketModule")

const PRINT_LINE = "\n==============================================\n";

logger.info(config.PROCCESS_NAME + " start (mode : " + config.PROCESS_MODE + ")");
// web socket setting
socketModule.webSocketListen();
// rabbitmq setting
rmqModule.connect();

// 서버 종료시 처리할 동작
function gracefulShutdown() {
    rmqModule.disconnect();
    logger.warn(PRINT_LINE + config.PROCCESS_NAME + " is termiatied. (SIGINT)" + PRINT_LINE);
}

process.on('SIGINT', () => {
    gracefulShutdown()
});

process.on('uncaughtException', (err, origin) => {
    logger.error("Caught exception: " + err.stack + "\n Exception origin: " + origin);
    gracefulShutdown()
});