const CACHE_KEY = "last_captured_tianjiguan_token";

if ($response && $response.body) {
    try {
        let bodyObj = JSON.parse($response.body);
        
        let token = bodyObj.data && bodyObj.data.token;
        
        if (token) {
            let lastToken = $persistentStore.read(CACHE_KEY);
            
            if (token === lastToken) {
                console.log("🤫 [静默记录] Token 持续捕获中: " + token);
            } else {
                console.log("🎉 [天机观] 成功捕获到新的 Token: " + token);
                $notification.post("🎉 天机观Token 捕获成功", "发现新的 Token", token);
                
                $persistentStore.write(token, CACHE_KEY);
            }
        } else {
            console.log("⚠️ 响应体中未找到 token 字段");
        }
    } catch (e) {
        console.log("❌ 解析响应体 JSON 失败: " + e.message);
    }
} else {
    console.log("⚠️ 响应体为空");
}

$done({});
