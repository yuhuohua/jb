const url = "https://api.iosxx.cn/dx.php?ChinaTelecom=17396213152*050116";

$httpClient.get(url, function(error, response, data) {
  // 1. 处理网络请求错误
  if (error) {
    console.log("请求失败：" + error);
    $notification.post("电信营业厅", "❌ 请求失败", "请检查网络\n" + error);
    $done();
    return;
  }

  // 2. 打印原始日志，方便在 Surge 的脚本日志中查看请求结果
  console.log("接口返回原始数据：\n" + data);

  try {
    let res = JSON.parse(data);
    
    // 3. 校验数据格式是否符合预期
    if (res.status === "success" && res.results && res.results.length > 0) {
      let resultInfo = res.results[0];
      
      if (resultInfo.success && resultInfo.data) {
        let d = resultInfo.data;
        
        // 提取所需的数据节点
        let phone = d.masked_phonenum || d.phonenum || "未知号码";
        let balance = d.balance ? `${d.balance.amount} ${d.balance.unit}` : "未知";
        let voice = d.voice ? `剩余 ${d.voice.balance} / 共 ${d.voice.total} ${d.voice.unit}` : "未知";
        let totalFlow = d.total_flow ? `剩余 ${d.total_flow.balance} / 共 ${d.total_flow.total} ${d.total_flow.unit}` : "未知";
        let commonFlow = d.common_flow ? `剩余 ${d.common_flow.balance} / 共 ${d.common_flow.total} ${d.common_flow.unit}` : "未知";
        
        // 拼接弹窗标题和副标题
        let title = "电信营业厅";
        let subtitle = `📱 尾号 ${phone.slice(-4)} | 💰 话费：${balance}`;
        
        // 拼接弹窗主体内容
        let detail = `📞 语音：${voice}\n` +
                     `📶 总流量：${totalFlow}\n` +
                     `🌐 通用流量：${commonFlow}`;
                     
        // 如果有定向流量，则追加显示
        if (d.special_flow) {
            detail += `\n📺 定向流量：剩余 ${d.special_flow.balance} / 共 ${d.special_flow.total} ${d.special_flow.unit}`;
        }
        
        // 发送通知
        $notification.post(title, subtitle, detail);
        console.log("✅ 解析并推送成功！");
        
      } else {
        console.log("接口数据状态异常：" + JSON.stringify(resultInfo));
        $notification.post("电信营业厅", "⚠️ 查询异常", resultInfo.error || "未在 results 中获取到有效 data");
      }
    } else {
      console.log("接口结构不匹配：" + data);
      $notification.post("电信营业厅", "⚠️ 解析失败", "接口状态非 success 或缺少 results 数组");
    }
  } catch (e) {
    // 捕获 JSON 解析错误
    console.log("JSON解析或执行错误：" + e);
    $notification.post("电信营业厅", "❌ 脚本执行出错", e.message);
  }
  
  $done();
});
