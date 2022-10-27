const config = require("../config/config")

const logger = require("./logger")

let websocketInfoMap = new Map();

const STATUS_IDLE = "IDLE";
const STATUS_READY = "READY";
const STATUS_ACTIVE = "ACTIVE";
const STATUS_INACTIVE = "INACTIVE";

// 웹 클라이언트 객체
// ws : websocket 객체 (key)
// status : 상태 (IDLE을 제외하고 SCM과 동일)
//  - IDLE : 접속 직후 상태
//  - READY : join_conf_req 상태
//  - ACTIVE : join_complete 완료 상태 (http 로 세션상태 조회 시작)
//  - INACTIVE : join_conf 는 완료되었으나 join_complete 를 받지 못했을 때, join_complete 가 완료된 후 http 로 상태조회 진행 중 세션 연결이 끊겼을 때. (inactive request 로 api server 로 상태끊김을 알려준다 )
// conferenceId : 회의방 ID
// clientId : 클라이언트 ID
// 
// mediaFlag : media server url 요청 flag true=1/false=0
// sharingFlag : sharing server url 요청 flag true=1/false=0
// mediaUrl : media server url
// sharingUrl : sharing server url
class WebsocketInfo {
    constructor(ws, clientUrl) {
        this.ws = ws;
        this.clientUrl = clientUrl;
        this.status = STATUS_IDLE;
        this.conferenceId = null;
        this.clientId = null;
        this.mediaFlag = false;
        this.sharingFlag = false;
        this.mediaUrl = null; 
        this.sharingUrl = null;
    }

    getWs() {
        return this.ws;
    }

    getClientUrl() {
        return this.clientUrl;
    }

    getStatus(){
        return this.status;
    }

    setConferenceId(conferenceId){
        this.conferenceId = conferenceId;
    }
    getConferenceId(){
        return this.conferenceId;
    }

    setClientId(clientId){
        this.clientId = clientId;
    }
    getClientId(){
        return this.clientId;
    }

    setMediaFlag(mediaFlag){
        this.mediaFlag = mediaFlag;
    }
    isMediaFlag(){
        return this.mediaFlag ? 1 : 0;
    }

    setSharingFlag(sharingFlag){
        this.sharingFlag = sharingFlag;
    }
    isSharingFlag(){
        return this.sharingFlag ? 1 : 0;
    }

    setMediaUrl(mediaUrl){
        this.mediaUrl = mediaUrl;
    }
    getMediaUrl(){
        return this.mediaUrl;
    }

    setSharingUrl(sharingUrl){
        this.sharingUrl = sharingUrl;
    }
    getSharingUrl(){
        return this.sharingUrl;
    }

    // IDLE     -> READY
    // READY    -> ACTIVE / INACTIVE / IDLE
    // ACTIVE   -> IDLE   / INACTIVE
    // INACTIVE -> IDLE
    // 현재 상태가 다음 상태로 천이 가능한지 확인하는 메서드
    isChangeAvailable(beforeStatus, afterStatus) {
        switch(beforeStatus) {
            case STATUS_IDLE:
                if(afterStatus == STATUS_READY) return true;
                break;
            case STATUS_READY:
                if(afterStatus == STATUS_IDLE) return true;
                else if(afterStatus == STATUS_ACTIVE) return true;
                else if(afterStatus == STATUS_INACTIVE) return true;
                break;
            case STATUS_ACTIVE:
                if(afterStatus == STATUS_IDLE) return true;
                else if(afterStatus == STATUS_INACTIVE) return true;
                break;
            case STATUS_INACTIVE:
                if(afterStatus == STATUS_IDLE) return true;
                break;
            default:
        }
        return false;
    }

    changeStatus(status){
        if(this.isChangeAvailable(this.status, status)) {
            logger.debug("("+this.clientUrl+") ("+this.conferenceId+") ("+this.clientId+") [" + this.status + "] -> [" + status + "] changed.")
            this.status = status;
            return true;
        }
        logger.warn("("+this.clientUrl+") ("+this.conferenceId+") ("+this.clientId+") [" + this.status + "] -> [" + status + "] is not possible.")
        return false;
    }

    initWebSocketInfo() {
        this.conferenceId = null;
        this.clientId = null;
        this.mediaFlag = false;
        this.sharingFlag = false;
        this.mediaUrl = null; 
        this.sharingUrl = null;
    }
}

// webclient 객체를 생성하고 맵에 저장하는 메서드
function createWebsocketInfo(ws, clientUrl) {
    if(websocketInfoMap.has(ws)) {
        logger.warn("("+ clientUrl +") websocketInfo is aleady exist.");
    } else {
        websocketInfoMap.set(ws, new WebsocketInfo(ws, clientUrl));
        logger.info("("+ clientUrl +") websocketInfo is created.");
    }
}

// webclient 객체를 삭제하는 메서드
function deleteWebsocketInfo(ws) {
    if(websocketInfoMap.has(ws)) {
        let clientUrl = websocketInfoMap.get(ws).getClientUrl();
        websocketInfoMap.delete(ws)
        logger.info("("+ clientUrl +") websocketInfo is deleted.");
    } else {
        logger.warn("websocketInfo do not exist.");
    }
}

// webclient 객체를 가져오는 메서드
function getWebsocketInfo(ws) {
    if(websocketInfoMap.has(ws)) {
        return websocketInfoMap.get(ws);
    } else {
        logger.warn("websocketInfo do not exist.");
        return null;
    }
}

// clientId를 통해 webclient 객체를 가져오는 메서드
function getWebsocketByClientId(clientId) {
    let ws = null;
    websocketInfoMap.forEach( (webInfo, key) => {
        if (clientId == webInfo.getClientId()) {
            ws = key;
            return;
        }
    })
    return ws;
}

// client 로 부터 websocket 을 통해 join_conf_req 메시지를 수신했을때 수행하는 메서드
function receiveJoinConfReqBySocket(webInfo, conferenceId, clientId, mediaFlag, sharingFlag) {
    if (webInfo.changeStatus(STATUS_READY)){
        webInfo.setConferenceId(conferenceId);
        webInfo.setClientId(clientId);
        webInfo.setMediaFlag(mediaFlag);
        webInfo.setSharingFlag(sharingFlag);
    }
}

// SCM 으로 부터 rmq 를 통해 join_conf_res 메시지를 수신했을때 수행하는 메서드
function receiveJoinConfResByRmq(ws, mediaUrl, sharignUrl) {
    if(websocketInfoMap.has(ws)) {
        let webInfo = websocketInfoMap.get(ws);
        webInfo.setMediaUrl(mediaUrl != undefined ? mediaUrl : null);
        webInfo.setSharingUrl(sharignUrl != undefined ? sharignUrl : null);
    } else {
        logger.warn("websocketInfo do not exist.");
    }
}

// SCM 으로 부터 rmq 를 통해 join_complete_res 메시지를 수신했을때 수행하는 메서드
function receiveJoinCompleteResByRmq(ws) {
    if(websocketInfoMap.has(ws)) {
        let webInfo = websocketInfoMap.get(ws);
        webInfo.changeStatus(STATUS_ACTIVE)
    } else {
        logger.warn("websocketInfo do not exist.");
    }
}

// client 로 부터 websocket 을 통해 leave_conf_req 메시지를 수신했을때 수행하는 메서드
function receiveLeaveConfResByRmq(ws) {
    if(websocketInfoMap.has(ws)) {
        let webInfo = websocketInfoMap.get(ws);
        if (webInfo.changeStatus(STATUS_IDLE)){
            webInfo.initWebSocketInfo();
        }
    } else {
        logger.warn("websocketInfo do not exist.");
    }
}

// 회의방 내 클라이언트 정보가 수정될 때마다 호출되어 클라이언트 리스트를 알리는 메서드
function notifyConference(conferenceId) {
    let clients = new Array();
    let notifyList = [];
    websocketInfoMap.forEach( (webInfo, key) => {
        if(conferenceId == webInfo.getConferenceId() && webInfo.getStatus() == STATUS_ACTIVE) {
            notifyList.push(key);
            clients.push({
                clientId: webInfo.getClientId(),
                mediaUrl: webInfo.getMediaUrl(),
                sharingUrl: webInfo.getSharingUrl()
            });
        }
    })

    if (clients.length == 0) {
        return
    }

    let conferenceInfo = {}
    conferenceInfo.conferenceId = conferenceId;
    conferenceInfo.total = clients.length;

    let notiMsg = {}
    notiMsg.type = config.CLIENT_LIST_NOTI;
    notiMsg.conferenceInfo = conferenceInfo;
    notiMsg.clients = clients

    let jsonMsg = JSON.stringify(notiMsg, null, 4);

    logger.info("(SOCKET) () (" + conferenceId + ") () Notify : \n"+jsonMsg);
    notifyList.forEach( (value) => {
        value.send(jsonMsg);
    })

}

function printWebsocketInfoMap() {
    websocketInfoMap.forEach( (webInfo) => {
        logger.info(printWebsocketInfo(webInfo))
    } )
}

function printWebsocketInfo(webInfo) {
    return "key : " + webInfo.getWs() + ", [sts : " + webInfo.getStatus() + 
    ", conf : " + webInfo.getConferenceId() + ", clt : " + webInfo.getClientId() + 
    ", mFg : " + webInfo.isMediaFlag() + ", sFg : " + webInfo.isSharingFlag() + 
    ", mUl : " + webInfo.getMediaUrl() + ", sUl : " + webInfo.getSharingUrl() + 
    "]"
} 

module.exports.createWebsocketInfo = createWebsocketInfo;
module.exports.deleteWebsocketInfo = deleteWebsocketInfo;
module.exports.getWebsocketInfo = getWebsocketInfo;
module.exports.getWebsocketByClientId = getWebsocketByClientId;

module.exports.receiveJoinConfReqBySocket = receiveJoinConfReqBySocket;
module.exports.receiveJoinConfResByRmq = receiveJoinConfResByRmq;
module.exports.receiveJoinCompleteResByRmq = receiveJoinCompleteResByRmq;
module.exports.receiveLeaveConfResByRmq = receiveLeaveConfResByRmq;

module.exports.notifyConference = notifyConference;


// module.exports.printWebsocketInfoMap = printWebsocketInfoMap;