const amqp = require('amqplib/callback_api')

const config = require("../config/config")

const logger = require("./logger")
const util = require("./util")
const websocketManager = require("./websocketInfoManager")
const socketModule = require("./websocketModule")

const CONFERENCE_ID_KEY = "conferenceId"
const CLIENT_ID_KEY = "clientId"
const MEDIA_FLAG_KEY = "mediaFlag"
const SHARING_FLAG_KEY = "sharingFlag"

// rabbitmq 통신 객체
let rmqConnection = null;
let rmqChannel = null;

// rabbitmq 연결
function connect() {
    amqp.connect(config.RMQ_SERVER_URI, function(error0, connection) {
        try{
            if (error0) {
                logger.error("Failed to connect : " + error0);
                return
            }

            if(rmqConnection != null){
                rmqConnection.close();
            }
        
            logger.info("RabbitMQ connect.");
            connection.createChannel(function(error1, channel) {
                if (error1) {
                    logger.error("Failed to create a channel  " + error1);
                    return
                  }
    
                setRmqChannel(channel);
            });

            connection.on('error', function(error2) {
                if(error2 == "Error: read ECONNRESET") {
                    logger.warn("RabbitMQ Connection Fail.");
                    logger.info("RabbitMQ ReConnect...");
                    connect();
                } else {
                    logger.warn("rabbitmqModule.connect.connection Exception: " + error2.stack);
                }
            })

            rmqConnection = connection;
        }catch(err){
            logger.error("rabbitmqModule.connect Exception : " + err.stack);
        }
    });
}

// rabbitmq 연결 해제 메서드
function disconnect() {
    if(rmqChannel != null) {
        rmqChannel.close();
        logger.info("RabbitMQ Channel is closed.");
    }
    if(rmqConnection != null) {
        rmqConnection.close();
        logger.info("RabbitMQ Connection is closed.");
    } else {
        logger.warn("RabbitMQ Connection is null.");
    }
}

function setRmqChannel(channel) {
    logger.info("RabbitMQ channel is create.");
    channel.prefetch(1, false);
    channel.assertQueue(config.RMQ_CONSUME_QUEUE, {durable: false});
    channel.consume(config.RMQ_CONSUME_QUEUE, function(msg) {
        try{
            logger.info("(RMQ) (" + config.RMQ_CONSUME_QUEUE + ") consume : \n"+msg.content.toString());
            let plainMsg = msg.content.toString().replace(/\u00a0/g, " ")
            if(!util.isJsonString(plainMsg)) {
                let printData = JSON.stringify(plainMsg, null, 4);
                logger.warn("The msg format is not json : \n"+printData);
                return
            }

            rmqMessageProcessing(JSON.parse(plainMsg));
        } catch(err){
            if(err.name == "TypeError") {
                logger.warn("RabbitMQ Channel Connect Fail. recovery... ");
                connect();
            } else {
                logger.error("rabbitmqModule.setRmqChannel exception "+err.stack);
            }
        }
    }, 
    {
        noAck: true
    });
    // channel.on('error', function(error0) {
    //     if(error0 == "IllegalOperationError: Channel closed") {
    //         logger.warn("RabbitMQ Channel Fail.");
    //         logger.info("RabbitMQ ReConsume...");
    //         setRmqChannel(channel);
    //     } else {
    //         logger.warn("rabbitmqModule.setRmqChannel.channel Exception: " + error0.stack);
    //     }
    // });
    logger.info("RabbitMQ ("+config.RMQ_CONSUME_QUEUE+") Consume start.");
    rmqChannel = channel;
}


// rabbitmq message consume 시 처리하는 메서드
function rmqMessageProcessing(jsonData) {
    try{
        let msgHeader = jsonData.header;
        let msgType = msgHeader.type;
        let msgBody = jsonData.body;

        let ws = websocketManager.getWebsocketByClientId(msgBody.clientId);

        // SCM 으로 부터 rmq join_conf_res 수신 시 socket rmq leave_conf_res 전송
        if(msgType == config.JOIN_CONF_RES){
            if(ws != null) {
                websocketManager.receiveJoinConfResByRmq(ws, msgBody.mediaUrl, msgBody.sharingUrl);
                let webInfo = websocketManager.getWebsocketInfo(ws);
                if (webInfo != null) {
                    let joinConfRes = socketModule.createJoinConfRes(msgBody.mediaUrl, msgBody.sharingUrl);
                    let sendMsg = JSON.stringify(joinConfRes, null, 4);
    
                    socketModule.sendSocketMessage(ws, msgBody.conferenceId, msgBody.clientId, sendMsg);
                }
            } else {
                logger.warn("() ("+ msgBody.conferenceId +") ("+ msgBody.clientId +") client is null.")
            }
        }
        // SCM 으로 부터 rmq join_complete_res 수신 시 socket rmq join_complete_res 전송
        else if (msgType == config.JOIN_COMPLETE_RES){
            if(ws != null) {
                websocketManager.receiveJoinCompleteResByRmq(ws);
                let webInfo = websocketManager.getWebsocketInfo(ws);
                if (webInfo != null) {
                    let joinCompleteRes = socketModule.createJoinCompleteRes(msgBody.conferenceId, msgBody.clientId)
                    let sendMsg = JSON.stringify(joinCompleteRes, null, 4);
    
                    socketModule.sendSocketMessage(ws, msgBody.conferenceId, msgBody.clientId, sendMsg);
                    websocketManager.notifyConference(msgBody.conferenceId);
                }
            } else {
                logger.warn("() ("+ msgBody.conferenceId +") ("+ msgBody.clientId +") client is null.")
            }
        }
        // SCM 으로 부터 rmq leave_conf_res 수신 시 socket rmq leave_conf_res 전송
        else if (msgType == config.LEAVE_CONF_RES) {
            if (ws != null) {
                let webInfo = websocketManager.getWebsocketInfo(ws);
                if (webInfo != null){
                    let conferenceId = msgBody.conferenceId;
                    let clientId = msgBody.clientId;
                    if(conferenceId != null) {
                        let leaveConfRes = socketModule.createLeaveConfRes()
                        let sendMsg = JSON.stringify(leaveConfRes, null, 4);
                        socketModule.sendSocketMessage(ws, conferenceId, clientId, sendMsg);
                        websocketManager.receiveLeaveConfResByRmq(ws);
                        websocketManager.notifyConference(conferenceId);
                    }
                }
            } else {
                logger.warn("() ("+ msgBody.conferenceId +") ("+ msgBody.clientId +") client is null.")
            }
        }
        else if (msgType == config.INACTIVE_SESSION_REQ) {
            if(ws != null) {
                let webInfo = websocketManager.getWebsocketInfo(ws);
                if (webInfo != null){
                    let conferenceId = msgBody.conferenceId;
                    sendInactiveSessionRes(msgHeader.transactionId, conferenceId, msgBody.clientId, config.REASON_SUCCESS, config.REASON_SUCCESS_CODE);
                    websocketManager.receiveLeaveConfResByRmq(ws);
                    websocketManager.notifyConference(conferenceId);
                }
            } else {
                sendInactiveSessionRes(msgHeader.transactionId, msgBody.conferenceId, msgBody.clientId, config.REASON_NOT_FOUND, config.REASON_NOT_FOUND_CODE);
                websocketManager.notifyConference(msgBody.conferenceId);
            }
            
        }
    } catch(err) {
        logger.error("rabbitmqModule.rmqMessageProcessing Exception : " + err.stack);
    }
}

// send join_conf_req message
function sendJoinConfReq(conferenceId, clientId, mediaFlag, sharingFlag) {
    try{
        let rmqMessage = {}
        rmqMessage.header = createRmqMsgHeader(null, config.JOIN_CONF_REQ, null, 0);
        rmqMessage.body = createRmqMsgBody(CONFERENCE_ID_KEY, conferenceId, CLIENT_ID_KEY, clientId, MEDIA_FLAG_KEY, mediaFlag, SHARING_FLAG_KEY, sharingFlag);
        let msg = JSON.stringify(rmqMessage, null, 4);

        sendRmqMessage(config.RMQ_PUBLISH_QUEUE, msg);
    } catch(err){
        logger.error("rabbitmqModule.sendJoinConfReq Exception : " + err.stack);
    }
}

// send join_complete_req message
function sendJoinCompleteReq(conferenceId, clientId) {
    try{
        let rmqMessage = {}
        rmqMessage.header = createRmqMsgHeader(null, config.JOIN_COMPLETE_REQ, null, 0);
        rmqMessage.body = createRmqMsgBody(CONFERENCE_ID_KEY, conferenceId, CLIENT_ID_KEY, clientId);
        let msg = JSON.stringify(rmqMessage, null, 4);

        sendRmqMessage(config.RMQ_PUBLISH_QUEUE, msg);
    } catch(err){
        logger.error("rabbitmqModule.sendJoinCompleteReq Exception : " + err.stack);
    }
}

// send leave_conf_req message
function sendLeaveConfReq(conferenceId, clientId) {
    try{
        let rmqMessage = {}
        rmqMessage.header = createRmqMsgHeader(null, config.LEAVE_CONF_REQ, null, 0);
        rmqMessage.body = createRmqMsgBody(CONFERENCE_ID_KEY, conferenceId, CLIENT_ID_KEY, clientId);
        let msg = JSON.stringify(rmqMessage, null, 4);

        sendRmqMessage(config.RMQ_PUBLISH_QUEUE, msg);
    } catch(err){
        logger.error("rabbitmqModule.sendLeaveConfReq Exception : " + err.stack);
    }
}

// send inactive_session_res message 
function sendInactiveSessionRes(transactionId, conferenceId, clientId, reason, reasonCode) {
    try{
        let rmqMessage = {}
        rmqMessage.header = createRmqMsgHeader(transactionId, config.INACTIVE_SESSION_RES, reason, reasonCode);
        rmqMessage.body = createRmqMsgBody(CONFERENCE_ID_KEY, conferenceId, CLIENT_ID_KEY, clientId);
        let msg = JSON.stringify(rmqMessage, null, 4);

        sendRmqMessage(config.RMQ_PUBLISH_QUEUE, msg);
    } catch(err){
        logger.error("rabbitmqModule.sendInactiveSessionRes Exception : " + err.stack);
    }
}

// rmq message 헤더를 생성하는 메서드
function createRmqMsgHeader(transactionId, type, reason, reasonCode) {
    let rmqHeader = {}
    rmqHeader.type = type;
    rmqHeader.transactionId = (transactionId == null ? util.createUuidV4() : transactionId);
    rmqHeader.msgFrom = config.RMQ_CONSUME_QUEUE;
    if(reason != null) rmqHeader.reason = reason;
    rmqHeader.reasonCode = reasonCode;
    rmqHeader.timestamp = util.getCurDate();
    return rmqHeader;
}

// rmq message 헤더를 생성하는 메서드
function createRmqMsgBody(...args) {

    if (args.length % 2) {
        logger.warn("createRmqMsgBody() Failed: The number of parameters is odd. ("+args.length+")");
        return {}
    }
    let rmqBody = {}
    
    for(let idx = 0; idx < args.length; idx += 2) {
        rmqBody[args[idx]] = args[idx+1]
    }
    return rmqBody;
}

// rmq message를 전송하는 메서드
function sendRmqMessage(queueName, msg) {
    try{
        if(rmqConnection == null || rmqChannel == null) {
            connect();
        }
        rmqChannel.sendToQueue(queueName, Buffer.from(msg));
        logger.info("(RMQ) (" + queueName + ") publish : \n"+msg);
    } catch(err){
        logger.error("rabbitmqModule.sendRmqMessage Exception : " + err.stack);
    }
}

module.exports.connect = connect;
module.exports.disconnect = disconnect;
module.exports.sendJoinConfReq = sendJoinConfReq;
module.exports.sendJoinCompleteReq = sendJoinCompleteReq;
module.exports.sendLeaveConfReq = sendLeaveConfReq;