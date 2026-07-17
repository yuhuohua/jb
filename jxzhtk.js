const CACHE_KEY = "last_captured_xtoken";
const headers = $request.headers;
const xToken = headers['X-Token'] || headers['x-token'];

if (xToken) {
    let lastToken = $persistentStore.read(CACHE_KEY);
   
    if (xToken === lastToken) {
        console.log("🤫 [静默记录] X-Token 持续捕获中: " + xToken);
    } else {
        console.log("🎉 [匠心忠华] 成功捕获到X-Token: " + xToken);
        $notification.post("🎉 X-Token 捕获成功", "发现新的 Token", xToken);
        
        $persistentStore.write(xToken, CACHE_KEY);
    }
} else {
    console.log("⚠️ 请求头中未找到 X-Token 字段");
}
$done({});
