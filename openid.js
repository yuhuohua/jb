const url = $request.url;
const regex = /openid=([^&]+)/;
const match = url.match(regex);

if (match && match[1]) {
    const openid = match[1];
    
    console.log(`🎉 成功获取: openid=${openid}`);
    
    const title = "🎉 微信 OpenID 获取成功";
    const subtitle = "";
    const body = `openid=${openid}\n(已打印至日志，长按通知可复制)`;
    
    if (typeof $notify !== "undefined") {
        $notify(title, subtitle, body);
    } else if (typeof $notification !== "undefined") {
        $notification.post(title, subtitle, body);
    }

} else {
    console.log("❌ 未能从该请求中提取到 openid");
}

$done({});
