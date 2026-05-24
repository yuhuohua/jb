/**
 * Surge / Loon 脚本：电信话费流量监控 (支持模块参数、面板显示、静默运行)
 * 参数格式：phone=手机号&pwd=服务密码&silent=# （silent=# 表示静默运行，不弹通知）
 */

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
const phone = args.phone;
const pwd = args.pwd;
const isSilent = args.silent === "#";

// 检查必要参数
if (!phone || !pwd) {
    const msg = "请配置手机号及服务密码：在模块参数中设置 phone=手机号&pwd=服务密码";
    if (!isSilent) {
        $notification.post("电信营业厅", "❌ 缺少参数", msg);
    }
    $done({
        title: "电信营业厅",
        content: "❌ 缺少参数: " + msg,
        icon: "simcard.fill",
        "icon-color": "#FF3B30"
    });
    return;
}

const url = `https://api.iosxx.cn/dx.php?ChinaTelecom=${encodeURIComponent(phone + '*' + pwd)}`;

$httpClient.get(url, function(error, response, data) {
  // 处理网络请求错误
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
        
        // 格式化手机号尾号
        let maskPhone = d.masked_phonenum || phone;
        let suffix = maskPhone.length > 4 ? maskPhone.slice(-4) : maskPhone;
        
        // 提取各项指标
        let balance = d.balance ? `${d.balance.amount} ${d.balance.unit}` : "未知";
        let voice = d.voice ? `${d.voice.balance}/${d.voice.total} ${d.voice.unit}` : "未知";
        let totalFlow = d.total_flow ? `${d.total_flow.balance}/${d.total_flow.total} ${d.total_flow.unit}` : "未知";
        let commonFlow = d.common_flow ? `${d.common_flow.balance} ${d.common_flow.unit}` : "未知";
        
        // 拼接标题与副标题
        let title = `电信营业厅 (尾号${suffix})`;
        let subtitle = `💰 话费余额: ${balance}`;
        
        // 拼接正文内容
        let detail = `📶 总流量: 剩余 ${totalFlow}\n` +
                     `🌐 通用: 剩余 ${commonFlow} | 📞 语音: 剩余 ${voice}`;
                     
        if (d.special_flow) {
            detail += `\n📺 定向: 剩余 ${d.special_flow.balance} ${d.special_flow.unit}`;
        }
        
        // 根据静默运行参数决定是否弹窗通知
        if (!isSilent) {
            $notification.post(title, subtitle, detail);
        }
        
        console.log("✅ 数据解析成功！" + (isSilent ? " [静默模式：仅更新面板]" : " [正常通知：已发送弹窗]"));
        
        // 返回面板格式数据
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