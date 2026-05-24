function getArgs() {
  if (typeof $argument === "undefined") return {};
  let args = {};
  let pairs = $argument.split("&");
  for (let pair of pairs) {
    let [key, val] = pair.split("=");
    if (key) args[key] = val ? decodeURIComponent(val) : "";
  }
  return args;
}

const args = getArgs();
const phone = args.phone || "";
const pwd = args.pwd || "";
const isSilent = args.silent === "#"; // 判断是否开启静默模式

const url = `https://api.iosxx.cn/dx.php?ChinaTelecom=${phone}*${pwd}`;

$httpClient.get(url, function(error, response, data) {
  if (error) {
    console.log("请求失败：" + error);
    let errDesc = "请检查网络或接口状态";
    if (!isSilent) {
      $notification.post("电信营业厅", "❌ 请求失败", errDesc);
    }
    $done({
      title: "电信营业厅",
      content: "❌ 请求失败: " + errDesc,
      icon: "simcard.fill",
      "icon-color": "#FF3B30"
    });
    return;
  }

  console.log("接口返回原始数据：\n" + data);

  try {
    let res = JSON.parse(data);
    
    if (res.status === "success" && res.results && res.results.length > 0) {
      let resultInfo = res.results[0];
      
      if (resultInfo.success && resultInfo.data) {
        let d = resultInfo.data;
        
        let maskPhone = d.masked_phonenum || phone;
        let suffix = maskPhone.length > 4 ? maskPhone.slice(-4) : maskPhone;
        
        let balance = d.balance ? `${d.balance.amount} ${d.balance.unit}` : "未知";
        let voice = d.voice ? `${d.voice.balance}/${d.voice.total} ${d.voice.unit}` : "未知";
        let totalFlow = d.total_flow ? `${d.total_flow.balance}/${d.total_flow.total} ${d.total_flow.unit}` : "未知";
        let commonFlow = d.common_flow ? `${d.common_flow.balance} ${d.common_flow.unit}` : "未知";
        
        let title = `电信营业厅 (尾号${suffix})`;
        let subtitle = `💰 话费余额: ${balance}`;
        
        let detail = `📶 总流量: 剩余 ${totalFlow}\n` +
                     `🌐 通用: 剩余 ${commonFlow} | 📞 语音: 剩余 ${voice}`;
                     
        if (d.special_flow) {
            detail += `\n📺 定向: 剩余 ${d.special_flow.balance} ${d.special_flow.unit}`;
        }
        
        if (!isSilent) {
            $notification.post(title, subtitle, detail);
        }
        
        console.log("✅ 数据解析成功！" + (isSilent ? " [静默模式：仅更新面板]" : " [正常通知：已发送弹窗]"));
        
        $done({
          title: title,
          subtitle: subtitle,
          content: detail,
          icon: "simcard.fill",
          "icon-color": "#0066cc"
        });
        
      } else {
        let errMsg = resultInfo.error || "未获取到有效数据";
        console.log("接口数据状态异常：" + errMsg);
        if (!isSilent) $notification.post("电信营业厅", "⚠️ 查询异常", errMsg);
        $done({ title: "电信营业厅", content: "⚠️ 查询异常: " + errMsg, icon: "simcard.fill", "icon-color": "#FFCC00" });
      }
    } else {
      console.log("接口返回状态异常");
      if (!isSilent) $notification.post("电信营业厅", "⚠️ 解析失败", "接口状态非 success");
      $done({ title: "电信营业厅", content: "⚠️ 解析失败: 接口状态非 success", icon: "simcard.fill", "icon-color": "#FFCC00" });
    }
  } catch (e) {
    console.log("JSON解析或脚本执行错误：" + e);
    if (!isSilent) $notification.post("电信營業厅", "❌ 脚本错误", e.message);
    $done({ title: "电信营业厅", content: "❌ 脚本错误: " + e.message, icon: "simcard.fill", "icon-color": "#FF3B30" });
  }
});
