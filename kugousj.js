const CACHE_KEY = "kugoukey";
const currentUrl = $request.url;

function notify(title, subtitle, body) {
    if (typeof $notify !== "undefined") {
        $notify(title, subtitle, body);
    } else if (typeof $notification !== "undefined") {
        $notification.post(title, subtitle, body); 
    }
}

function readVal(key) {
    if (typeof $prefs !== "undefined") {
        return $prefs.valueForKey(key); 
    } else if (typeof $persistentStore !== "undefined") {
        return $persistentStore.read(key); 
    }
    return null;
}

function writeVal(val, key) {
    if (typeof $prefs !== "undefined") {
        return $prefs.setValueForKey(val, key);
    } else if (typeof $persistentStore !== "undefined") {
        return $persistentStore.write(val, key);
    }
    return false;
}

if (currentUrl) {
    let lastUrl = readVal(CACHE_KEY);
    if (currentUrl === lastUrl) {
        console.log("\n🤫 [静默记录] 酷狗数据  持续捕获中: \n" + currentUrl);
    } else {
        console.log("\n🎵 [新捕获] 成功捕获到新的酷狗数据 : \n" + currentUrl);
        notify("🎵 酷狗数据  捕获成功", "发现新的数据", currentUrl);
        writeVal(currentUrl, CACHE_KEY);
    }
} else {
    console.log("⚠️ 未获取到数据");
}

$done({});
