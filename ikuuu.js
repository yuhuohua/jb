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

if (!account || !account.includes(':')) {
  if (!silent) $notification.post('ikuuu 签到失败', '', '参数格式错误，请填写 邮箱:密码');
  $done();
}

const [email, pwd] = account.split(':');
const url = `http://ikuuu.iosxx.cn/?ikuuu=${encodeURIComponent(email + '*' + pwd)}`;

console.log(`🚀 开始签到，正在请求接口...`);
console.log(`💡 当前运行模式: ${silent ? '🤫 静默运行' : '🔔 通知运行'}`);

$httpClient.get(url, (error, response, data) => {
  if (error) {
    if (!silent) $notification.post('ikuuu 签到失败', '', `网络错误: ${error}`);
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
    if (!silent) {
      $notification.post('ikuuu 签到失败', `📧 ${email}`, `解析失败，原始返回片段:\n${snippet}`);
    }
    $done();
    return;
  }

  if (!silent) {
    $notification.post(
      'ikuuu 签到',
      `📧 ${email}`,
      `🎯 ${resultLine}\n📊 剩余流量: ${trafficLine || '未知'}`
    );
  }

  $done();
});
