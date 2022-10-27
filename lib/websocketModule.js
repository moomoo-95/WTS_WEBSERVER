const express = require('express')
const https = require('https')
const fs = require('fs')
const { WebSocketServer } = require("ws")

const config = require("../config/config")

const websocketManager = require("./websocketInfoManager")
const rmqModule = require("./rabbitmqModule")
const logger = require("./logger")
const util = require("./util")

const app = express()

// 모드에 따른 웹 listen
function webSocketListen() {
    try{
        // 개발 : http
        if(config.PROCESS_MODE == "dev") {
            app.listen(config.HTTP_PORT, () => {
                logger.info(config.PROCCESS_NAME + " HTTP server listening on port " + config.HTTP_PORT)
            })
            
            // ws:// 웹소켓 bind
            websocketInit(new WebSocketServer({ port: 8001 }));
            logger.info("Websocket HTTP server listening on port " + 8001);
        }
        // 상용 : https
        else {
            // ssl 옵션
            const options = {
                key: fs.readFileSync('./ssl/airtc_uangel_com.key'),
                cert: fs.readFileSync('./ssl/airtc_uangel_com.crt')
            };

            let httpsServer = https.createServer(options, app).listen(config.HTTPS_PORT, function() {
                logger.info("Websocket HTTPS server listening on port " + config.HTTPS_PORT);
            });

            // wss:// 웹소켓 bind
            websocketInit(
                new WebSocketServer({
                    server : httpsServer,
                    autoAcceptConnections: false
                })
            );
        }
    }
    catch(err) {
        logger.error("websocketModule.webSocketListen Exception : " + err.stack);
    }
}


function websocketInit(wss) {
    // websocket server에 websocket 연결 시 수행되는 메서드
    wss.on("connection", (ws, request) => {
        let clientUrl = request.connection.remoteAddress.substring(7) + ":" + request.connection.remotePort;
        websocketManager.createWebsocketInfo(ws, clientUrl);
        // 메시지 수신 시 수행되는 메서드
        ws.on("message", (data) => {
            try{
                if(!util.isJsonString(data)) {
                    logger.warn("(SOKCET) (" + clientUrl + ") () () The data format is not json : "+data.toString());
                    return
                }

                let webInfo = websocketManager.getWebsocketInfo(ws);
                if(webInfo != null) {
                    socketMessageProcessing(webInfo, JSON.parse(data));
                }
            } catch(err) {
                logger.error("websocket.message Exception : " + err.stack);
            }
        });
        // 연결 해제 시 수행할 메서드
        ws.on("close", () => {
            try{
                let webInfo = websocketManager.getWebsocketInfo(ws);
                if (webInfo != null){
                    let conferenceId = webInfo.getConferenceId();
                    if(conferenceId != null) {
                        rmqModule.sendLeaveConfReq(webInfo.getConferenceId(), webInfo.getClientId());
                        websocketManager.receiveLeaveConfResByRmq(ws);
                        websocketManager.notifyConference(conferenceId);
                    }
                }
                websocketManager.deleteWebsocketInfo(ws);
            } catch(err) {
                logger.error("websocket.close Exception : " + err.stack);
            }
        });      
    })
}

// socket 메시지 수신시 처리하는 메서드
function socketMessageProcessing(webInfo, jsonData) {
    try{
        let printData = JSON.stringify(jsonData, null, 4);
        let type = jsonData.type;
        // web client 로 부터 socket join_conf_req 수신 시 rmq join_conf_req 전송
        logger.info("(SOCKET) (" + webInfo.getClientUrl() + ") ("+ jsonData.conferenceId + ") (" + jsonData.clientId + ") recv msg : \n" + printData);
        if(type == config.JOIN_CONF_REQ){
            websocketManager.receiveJoinConfReqBySocket(webInfo, jsonData.conferenceId, jsonData.clientId, jsonData.mediaFlag, jsonData.sharingFlag)
            rmqModule.sendJoinConfReq(jsonData.conferenceId, jsonData.clientId, jsonData.mediaFlag ? 1 : 0, jsonData.sharingFlag ? 1 : 0);
        }
        // web client 로 부터 socket join_complete_req 수신 시 rmq join_complete_req 전송
        else if(type == config.JOIN_COMPLETE_REQ){
            rmqModule.sendJoinCompleteReq(jsonData.conferenceId, jsonData.clientId);
        }
        // web client 로 부터 socket leave_conf_req 수신 시 rmq leave_conf_req 전송
        else if(type == config.LEAVE_CONF_REQ){
            rmqModule.sendLeaveConfReq(jsonData.conferenceId, jsonData.clientId);
        }else {
            logger.warn("(SOCKET) (" + webInfo.getClientUrl() + ") ("+ jsonData.conferenceId + ") (" + jsonData.clientId + ") recv unexpected msg : \n" + printData);
        }
    }catch(err){
        logger.error("websocketModule.socketMessageProcessing Exception : " + err.stack);
    }
}

// join_conf_res 수신 시 web client와 송수신할 join_conf_res 메시지를 생성하는 메서드
function createJoinConfRes(mediaUrl, sharingUrl) {
    let socketMsg = {}
    socketMsg.type = config.JOIN_CONF_RES;
    socketMsg.mediaUrl = mediaUrl;
    socketMsg.sharingUrl = sharingUrl;
    return socketMsg;
}

// join_complete_res 수신 시 web client와 송수신할 join_complete_res 메시지를 생성하는 메서드
function createJoinCompleteRes(conferenceId, clientId) {
    let socketMsg = {}
    socketMsg.type = config.JOIN_COMPLETE_RES;
    socketMsg.conferenceId = conferenceId;
    socketMsg.clientId = clientId;
    return socketMsg;
}

// inactive_session_req 수신 시 web client와 송수신할 leave_conf_res 메시지를 생성하는 메서드
function createLeaveConfRes() {
    let socketMsg = {}
    socketMsg.type = config.LEAVE_CONF_RES;
    return socketMsg;
}

// socket message를 전송하는 메서드
function sendSocketMessage(ws, conferenceId, clientId, sendMsg) {
    try{
        let webInfo = websocketManager.getWebsocketInfo(ws);
        ws.send(sendMsg);
        logger.info("(SOCKET) (" + webInfo.getClientUrl() + ") ("+ conferenceId + ") (" + clientId + ") send msg : \n" + sendMsg);
    } catch(err){
        logger.error("websocketModule.sendSocketMessage Exception : " + err.stack);
    }
}


module.exports.webSocketListen = webSocketListen;
module.exports.createJoinConfRes = createJoinConfRes;
module.exports.createJoinCompleteRes = createJoinCompleteRes;
module.exports.createLeaveConfRes = createLeaveConfRes;
module.exports.sendSocketMessage = sendSocketMessage;