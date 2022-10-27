module.exports = {
    // PROCESS_MODE : "simu",
    PROCESS_MODE : "dev",
    PROCCESS_NAME : "WeMeet Web Server",
    
    HTTP_PORT : 8000,
    HTTPS_PORT : 8443,

    RMQ_SERVER_URI : "amqp://id:passwd@ip",
    // RMQ_PUBLISH_QUEUE : "S_SCM",
    // RMQ_CONSUME_QUEUE : "S_API",
    RMQ_PUBLISH_QUEUE : "WEB_SERVER_PUB",
    RMQ_CONSUME_QUEUE : "WEB_SERVER_CON",

    REASON_SUCCESS : "success",
    REASON_SUCCESS_CODE : 0,
    REASON_NOT_FOUND : "Not Found",
    REASON_NOT_FOUND_CODE : 404,

    JOIN_CONF_REQ : "join_conf_req",
    JOIN_CONF_RES : "join_conf_res",
    JOIN_COMPLETE_REQ : "join_complete_req",
    JOIN_COMPLETE_RES : "join_complete_res",
    LEAVE_CONF_REQ : "leave_conf_req",
    LEAVE_CONF_RES : "leave_conf_res",
    INACTIVE_SESSION_REQ : "inactive_session_req",
    INACTIVE_SESSION_RES : "inactive_session_res",

    CLIENT_LIST_NOTI : "client_list_noti"
    
}