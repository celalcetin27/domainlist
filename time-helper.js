const remain = (time) => {
    const getCurrentTimeStamp = function () {
    const now = new Date();
    const utc_timestamp = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    );
    return utc_timestamp;
 };
    const getElapsedTime = (date) => date - getCurrentTimeStamp()
    var expDate = new Date(`${time}`).getTime()
    var our = Math.floor(getElapsedTime(expDate)  / (1000 * 3600 * 24))
    return our
}
export {remain}