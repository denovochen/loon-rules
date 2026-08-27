/******************************
 * NodeSeek - Loon
 * Converted from Nullwhy/Egern NodeSeek.js
 * Features: request-header capture + scheduled check-in
 ******************************/

var SCRIPT_NAME = "NodeSeek🎉";
var STORE_KEY = "nodeseek_headers";
var ATTEND_BASE = "https://www.nodeseek.com/api/attendance";

var DEFAULT_HEADERS = {
  "Connection": "keep-alive",
  "Accept-Encoding": "gzip, deflate, br",
  "Priority": "u=3, i",
  "Content-Type": "text/plain;charset=UTF-8",
  "Origin": "https://www.nodeseek.com",
  "refract-sign": "",
  "User-Agent": "Mozilla/5.0",
  "refract-key": "",
  "Sec-Fetch-Mode": "cors",
  "Cookie": "",
  "Host": "www.nodeseek.com",
  "Referer": "https://www.nodeseek.com/",
  "Accept-Language": "zh-CN,zh-Hans;q=0.9",
  "Accept": "*/*"
};

var HEADER_KEYS = Object.keys(DEFAULT_HEADERS);

function log(msg) {
  console.log("[" + SCRIPT_NAME + "] " + msg);
}

function notify(subtitle, body) {
  log(subtitle + ": " + body);
  if (typeof $notification !== "undefined" && $notification.post) {
    $notification.post(SCRIPT_NAME, subtitle, body);
  }
}

function getArgument(name) {
  if (typeof $argument === "undefined" || $argument == null) return undefined;
  if (typeof $argument === "object") return $argument[name];
  return undefined;
}

function argTrue(name) {
  var value = getArgument(name);
  if (value == null || String(value).trim() === "") return false;
  return ["1", "true", "yes", "on"].indexOf(String(value).trim().toLowerCase()) !== -1;
}

function headerValue(src, key) {
  if (!src) return "";
  if (src[key] != null) return src[key];

  var target = String(key).toLowerCase();
  var keys = Object.keys(src);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() === target) return src[keys[i]];
  }
  return "";
}

function pickHeaders(src) {
  var saved = {};
  for (var i = 0; i < HEADER_KEYS.length; i++) {
    var key = HEADER_KEYS[i];
    var value = headerValue(src || {}, key);
    if (value !== "" && value != null) saved[key] = value;
  }
  return saved;
}

function buildAttendHeaders(saved) {
  var headers = {};
  for (var i = 0; i < HEADER_KEYS.length; i++) {
    var key = HEADER_KEYS[i];
    headers[key] = (saved && saved[key] != null) ? saved[key] : DEFAULT_HEADERS[key];
  }
  return headers;
}

function finishHttp() {
  if (typeof $done !== "undefined") $done({});
}

function finishTask() {
  if (typeof $done !== "undefined") $done();
}

function captureHeaders() {
  var reqHeaders = (typeof $request !== "undefined" && $request && $request.headers) ? $request.headers : {};
  var saved = pickHeaders(reqHeaders);

  if (Object.keys(saved).length === 0) {
    notify("Cookie 失败", "未获取到请求头");
    finishHttp();
    return;
  }

  var ok = $persistentStore.write(JSON.stringify(saved), STORE_KEY);
  if (!ok) {
    notify("Cookie 失败", "请求头写入本地存储失败");
    finishHttp();
    return;
  }

  var warning = saved.Cookie ? "" : "（未发现 Cookie，若签到失败请重新抓取）";
  log("请求头已保存，共 " + Object.keys(saved).length + " 个字段");
  notify("Cookie 成功", "请求头已保存" + warning + "，请关闭插件的 Cookie 捕获开关");
  finishHttp();
}

function doCheckIn() {
  var fixed = argTrue("fixed_legs");
  var url = ATTEND_BASE + "?random=" + (fixed ? "false" : "true");
  log("开始执行签到任务（" + (fixed ? "固定 5 鸡腿" : "随机鸡腿") + "）");

  var raw = $persistentStore.read(STORE_KEY);
  if (!raw) {
    notify("缺少请求头", "请先打开 Cookie 捕获并访问 NodeSeek 个人页面");
    finishTask();
    return;
  }

  var saved;
  try {
    saved = JSON.parse(raw);
  } catch (e) {
    notify("数据异常", "已保存的请求头损坏，请重新抓取");
    finishTask();
    return;
  }

  var params = {
    url: url,
    headers: buildAttendHeaders(saved),
    body: "",
    timeout: 10000,
    "auto-cookie": false
  };

  $httpClient.post(params, function (error, response, data) {
    if (error) {
      notify("网络错误", String(error));
      finishTask();
      return;
    }

    var status = response ? (response.status || response.statusCode || 0) : 0;
    var text = data || "";
    var message = "";
    var parsed = null;

    try {
      parsed = JSON.parse(text);
      message = parsed && parsed.message ? String(parsed.message) : "";
    } catch (e) {}

    var modeTag = fixed ? "固定" : "随机";
    if (status === 403) {
      notify("被风控", "403，稍后重试");
    } else if (status === 500) {
      notify("服务器错误", "500");
    } else if (status >= 200 && status < 300) {
      if (parsed && parsed.success === false) {
        notify("签到失败（" + modeTag + "）", message || "接口返回失败");
      } else {
        notify("签到成功（" + modeTag + "）", message || "签到完成");
      }
    } else {
      notify("请求异常", "HTTP " + status + (message ? "：" + message : ""));
    }

    finishTask();
  });
}

if (typeof $request !== "undefined" && $request) {
  captureHeaders();
} else {
  doCheckIn();
}
