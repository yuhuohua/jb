/**
 * 接口由贰月红大佬提供，感谢贰月红大佬。
 */
let account = '';
let silent = false;

const arg = typeof $argument !== 'undefined' ? $argument : '';

if (arg) {
  if (Array.isArray(arg)) {
    account = arg[0] || '';
    silent = arg[1] === '#' || arg[1] === 'true' || arg[1] === true;
  } else if (typeof arg === 'object') {
    account = arg.account || '';
    silent = arg.silent === '#' || arg.silent === 'true' || arg.silent === true;
  } else if (typeof arg === 'string') {
    const trimmedArg = arg.trim();
    
    if (trimmedArg.includes('#')) {
      silent = true;
    }

    if (trimmedArg.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmedArg);
        account = arr[0] || '';
      } catch (e) {
        console.log(`❌ JSON 解析失败: ${e.message}`);
      }
    } else {
      const cleanArg = trimmedArg.replace('#', '').trim();
      const parts = cleanArg.split(' ');
      account = parts[0] || '';
    }
  }
}

function notifyAndLog(title, subtitle, message, isError = false) {
  console.log(`\n========= 🔔 通知与日志 =========`);
  console.log(`[标题] ${title}`);
  console.log(`[副标] ${subtitle}`);
  console.log(`[内容] \n${message}`);
  console.log(`=================================\n`);
  
  if (!silent || isError) {
    $notification.post(title, subtitle, message);
  }
}

if (!account || !account.includes(':')) {
  notifyAndLog('ikuuu 签到失败', '', '参数格式错误，请填写 邮箱:密码', true);
  $done();
} else {
  const [email, pwd] = account.split(':');
  const url = `http://ikuuu.iosxx.cn/?ikuuu=${encodeURIComponent(email + '*' + pwd)}`;

  console.log(`🚀 开始签到，正在请求接口...`);
  console.log(`💡 当前运行模式: ${silent ? '🤫 静默运行 (成功不弹窗，失败强制弹窗)' : '🔔 全通知运行'}`);

  $httpClient.get(url, (error, response, data) => {
    if (error) {
      notifyAndLog('ikuuu 签到失败', `📧 ${email}`, `网络错误: ${error}`, true);
      $done();
      return;
    }

    const cleanData = data.replace(/\r/g, '');
    
    const resultMatch = cleanData.match(/(?:结果[:：]|🎯\s*结果[:：])\s*(.+)/);
    const trafficMatch = cleanData.match(/(?:剩余流量[:：]|📊\s*剩余流量[:：])\s*(.+)/);

    const resultLine = resultMatch ? resultMatch[1].trim() : '';
    const trafficLine = trafficMatch ? trafficMatch[1].trim() : '';

    if (!resultLine) {
      const snippet = cleanData.substring(0, 200);
      notifyAndLog('ikuuu 签到失败', `📧 ${email}`, `解析失败，原始返回片段:\n${snippet}`, true);
      $done();
      return;
    }

    const isFailedResult = /失败|错误|异常|未找到|过期|频繁/.test(resultLine);
    const title = isFailedResult ? 'ikuuu 签到失败' : 'ikuuu 签到通知';
    
    notifyAndLog(
      title,
      `📧 ${email}`,
      `🎯 ${resultLine}\n📊 剩余流量: ${trafficLine || '未知'}`,
      isFailedResult
    );

    $done();
  });
}
