// UUID 를 생성하는 메서드
module.exports.createUuidV4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 현재 시간을 반환하는 메서드
module.exports.getCurDate = () => {
    let date = new Date();
    return dateToString(date.getFullYear(), 4) + 
    '-' + dateToString(date.getMonth() + 1, 2) + 
    '-' + dateToString(date.getDate(), 2 ) +
    ' ' + dateToString(date.getHours(), 2) +
    ':' + dateToString(date.getMinutes(), 2) +
    ':' + dateToString(date.getSeconds(), 2) +
    '.' + dateToString(date.getMilliseconds(), 3);
}
// date 클래스 내 변수를 처리하여 반환하는 메서드
function dateToString(number, padLength) {
    return number.toString().padStart(padLength, '0');
}

// json 포맷인지 확인하는 메서드
module.exports.isJsonString = (str) => {
    try {
      var json = JSON.parse(str);
      return (typeof json === 'object');
    } catch (e) {
      return false;
    }
}