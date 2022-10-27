const winston = require('winston')
const winstonDaily = require('winston-daily-rotate-file')
const process = require('process')

const { combine, timestamp, label, printf } = winston.format;

//* 로그 파일 저장 경로 → 루트 경로/logs 폴더
const logDir = `${process.cwd()}/logs`;

//* log 출력 포맷 정의 함수
const logFormat = printf(({ level, message, label, timestamp }) => {
   return `[${timestamp}] [${label}] [`+ `${level.toUpperCase()}`.padEnd(5, " ") + `] ${message} `; // 날짜 로그레벨 [시스템이름] 메세지
});

/*
 * Log Level
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const logger = winston.createLogger({
   //* 로그 출력 형식 정의
   format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      label({ label: process.pid }),
      logFormat, // log 출력 포맷
   ),
   //* 실제 로그를 어떻게 기록을 한 것인가 정의
   transports: [
      //* debug 레벨 로그를 저장할 파일 설정 (debug: 3 보다 높은 error: 0, warn: 1, info: 2 로그들도 자동 포함해서 저장)
      new winstonDaily({
         level: 'debug', // debug 레벨에선
         datePattern: 'YYYYMMDD', // 파일 날짜 형식
         dirname: logDir, // 파일 경로
         filename: `webserver.%DATE%.log`, // 파일 이름
         maxFiles: 90, // 최근 90일치 로그 파일을 남김
         createSymlink: true,
         symlinkName: 'webserver.log'
      })
   ],
   //* uncaughtException 발생시 파일 설정
   exceptionHandlers: [
      new winstonDaily({
         level: 'error',
         datePattern: 'YYYYMMDD',
         dirname: logDir + '/exception',
         filename: `webserver.%DATE%.exception.log`,
         maxFiles: 90
      }),
   ],
});

module.exports = logger;