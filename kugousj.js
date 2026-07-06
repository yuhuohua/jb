const CACHE_KEY = "kugoukey";
const currentUrl = $request.url;
if (currentUrl) {
    let lastUrl = $persistentStore.read(CACHE_KEY);
    if (currentUrl === lastUrl) {
        console.log("🤫 [静默记录] 酷狗数据  持续捕获中: " + currentUrl);
    } else {
        console.log("🎵 [新捕获] 成功捕获到新的酷狗数据 : " + currentUrl);
        $notification.post("🎵 酷狗数据  捕获成功", "发现新的数据", currentUrl);
        $persistentStore.write(currentUrl, CACHE_KEY);
    }
} else {
    console.log("⚠️ 未获取到数据");
}

$done({});
