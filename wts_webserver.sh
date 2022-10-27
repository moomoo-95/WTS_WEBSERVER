#!/bin/bash

SERVICE_NAME=WTSWebServer
# HOME=/home/webserver/wemeet_webserver
HOME=/Users/lhs/Desktop/PROJECT/WeTalkSquare/WTS_WEBSERVER/src

# if [ "$USER" != "webserver" ] ; then
if [ "$USER" != "lhs" ] ; then
	echo "Need to be application account(webserver)"
	exit 1
fi

checkfile()
{
	if [ ! -e $1 ]; then
		echo "$1" file does not exist.
		exit 2
	fi
}
checkdir()
{
	if [ ! -d $1 ]; then
		echo "$1" directory does not exist.
		exit 3
	fi
}


case $1 in
    start)
    PID=`ps -ef | grep node | grep ${HOME}/app.js | awk '{print $2}'`
    if [ -z $PID ]
        then
            echo `nohup node $HOME/app.js > /dev/null 2>&1 &`
            echo "$SERVICE_NAME started ..."
	else
	    	echo "$SERVICE_NAME is aleady running"
	fi
    ;;
   stop)
	PID=`ps -ef | grep node | grep ${HOME}/app.js | awk '{print $2}'`
    if [ -z $PID ]
        then
            echo "$SERVICE_NAME is not running"
    else
            echo "stopping $SERVICE_NAME"
            kill -2 $PID
            sleep 1
            PID=`ps -ef | grep node | grep ${HOME}/app.js | awk '{print $2}'`
            if [ ! -z $PID ]
                then
                    kill -9 $PID
            fi
            echo "$SERVICE_NAME stopped"
	fi
    ;;
esac

exit 0