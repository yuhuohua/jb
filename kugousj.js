const currentUrl = $request.url;

console.log("🎵 酷狗 URL 捕获成功: " + currentUrl);
$notification.post("🎵 酷狗 URL 捕获成功", "已记录到日志", currentUrl);

$done({});
