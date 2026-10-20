const LOTTERY_CONFIG = {
  '双色球': { index: 0, prefix: '🔴' },
  '大乐透': { index: 1, prefix: '🔵' },
  '排列三': { index: 2, prefix: '🟢' },
  '福彩3D': { index: 3, prefix: '🟠' },
  '福彩 3D': { index: 3, prefix: '🟠' },
  '七星彩': { index: 4, prefix: '🟡' },
  '七乐彩': { index: 5, prefix: '🟡' },
  '排列五': { index: 6, prefix: '🟢' },
};

let rawArgument = typeof $argument !== 'undefined' && $argument ? String($argument) : '';
console.log(`[参数调试] 原始收到的 $argument 值为: [${rawArgument}]`);

let argContent = rawArgument;
if (rawArgument.startsWith('apps=')) {
  argContent = rawArgument.substring(5);
}

let targetLotteries = argContent.split(';')
  .map(s => s.trim().replace(/^["']|["']$/g, ''))
  .filter(s => s && (LOTTERY_CONFIG[s] || s === '福彩 3D'));

targetLotteries = targetLotteries.map(s => s === '福彩 3D' ? '福彩3D' : s);
targetLotteries = [...new Set(targetLotteries)];

if (targetLotteries.length === 0) {
  targetLotteries = ['双色球'];
}

console.log(`[参数调试] 最终解析生效的关注彩种列表: [${targetLotteries.join(', ')}]`);

const cacheKey = 'lottery_multi_cache';

function formatAmount(amount) {
  const num = parseFloat(amount);
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return amount;
}

if (typeof $script !== 'undefined' &&$script.type === 'cron') {
  console.log(`[彩票任务] 开始执行定时更新，监控彩种数: ${targetLotteries.length}`);
  const API_URL = 'https://m.zhuying.com/api/lotapi/indexV2/1';

  $httpClient.get({
    url: API_URL,
    timeout: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      'Accept': 'application/json'
    }
  }, (error, response, body) => {
    if (error || response.status !== 200) {
      console.log(`[彩票错误] 网络请求异常: ${error || response.status}`);
      $done();
      return;
    }

    try {
      const json = JSON.parse(body);
      const dataArray = [...json.data];
      if (dataArray.length > 2) dataArray.splice(2, 1);

      const oldCacheStr = $persistentStore.read(cacheKey);
      let cacheObj = oldCacheStr ? JSON.parse(oldCacheStr) : {};
      let hasUpdates = false;

      for (const name of targetLotteries) {
        const conf = LOTTERY_CONFIG[name];
        if (!conf) continue;

        const rawData = dataArray[conf.index];

        if (rawData && rawData.firstNumbers) {
          const firstArr = rawData.firstNumbers.split(',').map(n => n.trim().padStart(2, '0')).filter(n => n);
          const lastArr = rawData.lastNumbers ? rawData.lastNumbers.split(',').map(n => n.trim().padStart(2, '0')).filter(n => n) : [];
          
          const newData = {
            issue: rawData.issue || '',
            firstArr,
            lastArr,
            poolText: formatAmount(rawData.poolAmount || '0'),
            officeTime: rawData.officeOpenTime ? rawData.officeOpenTime.substring(0, 5) : ''
          };

          const issueNum = newData.issue ? newData.issue.slice(-3) : '---';

          if (!cacheObj[name] || cacheObj[name].issue !== newData.issue) {
            let numbersStr = newData.firstArr.join(' ');
            if (newData.lastArr.length > 0) numbersStr += ` | ${newData.lastArr.join(' ')}`;

            console.log(`[彩票通知] 🎯 发现【${name}】新开奖！期号: ${newData.issue}`);

            $notification.post(
              `${conf.prefix} ${name} 第${issueNum}期 新开奖`, 
              `号码: ${numbersStr}`, 
              `奖池: ${newData.poolText} | 开奖时间: ${newData.officeTime}`
            );
            hasUpdates = true;
          }

          cacheObj[name] = newData;
        }
      }

      if (hasUpdates || !oldCacheStr) {
        $persistentStore.write(JSON.stringify(cacheObj), cacheKey);
        console.log(`[彩票任务] 本地缓存已更新。`);
      } else {
        console.log(`[彩票任务] 所有监控彩种均为最新。`);
      }

    } catch (e) {
      console.log(`[彩票错误] 数据解析异常: ${e.message}`);
    }
    $done();
  });
} 

else {
  console.log(`[彩票面板] 开始加载面板渲染...`);
  const cachedStr = $persistentStore.read(cacheKey);

  if (!cachedStr) {
    $done({
      title: `🎰 彩票开奖数据获取中`,
      content: '暂无本地开奖数据\n请等待定时任务运行或手动执行获取',
      icon: 'ticket',
      'icon-color': '#FF9500'
    });
    return;
  }

  try {
    const cacheObj = JSON.parse(cachedStr);
    let contentLines = [];

    for (const name of targetLotteries) {
      const data = cacheObj[name];
      const conf = LOTTERY_CONFIG[name] || { prefix: '❓' };
      
      if (!data) {
        contentLines.push(`${conf.prefix} ${name}: 暂无缓存`);
        continue;
      }

      const issueNum = data.issue ? data.issue.slice(-3) : '---';
      let numStr = data.firstArr.join(' ');
      if (data.lastArr && data.lastArr.length > 0) {
        numStr += ` | ${data.lastArr.join(' ')}`;
      }

      let line = `${conf.prefix} ${name}(${issueNum}) ${numStr}`;
      if (data.poolText && data.poolText !== '0') {
        line += ` 💰${data.poolText}`;
      }
      contentLines.push(line);
    }

    $done({
      title: `🎰 每日彩票开奖`,
      content: contentLines.join('\n'),
      icon: 'ticket',
      'icon-color': '#FF3B30'
    });
  } catch (e) {
    $done({
      title: `🎰 面板渲染异常`,
      content: '读取本地缓存失败',
      icon: 'xmark.circle',
      'icon-color': '#FF3B30'
    });
  }
}
