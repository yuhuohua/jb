const version = "3.89.0";
let message = "";

!(async () => {
  let savedToken = $persistentStore.read("tastien_token") || "";
  let argToken = typeof $argument !== "undefined" ? $argument : "";
  
  let combinedTokens = [savedToken, argToken].filter(Boolean).join("@");
  
  if (!combinedTokens) {
    console.log("未检测到 user-token，请先打开小程序获取，或在 argument 中填写");
    $notification.post("🍔 塔斯汀汉堡", "参数缺失", "请先打开小程序获取 Token");
    return;
  }

  let tokens = [...new Set(combinedTokens.split(/@|&/).filter(Boolean))];
  console.log(`\n=========开始执行塔斯汀签到，共 ${tokens.length} 个账号=========\n`);

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    console.log(`\n--- 账号 [${i + 1}] 开始 ---`);
    await runTask(token, i + 1);
  }

  if (message) {
    $notification.post("🍔 塔斯汀汉堡签到", "", message.trim());
  }
})()
  .catch(e => {
    console.log(`执行报错: ${e}`);
  })
  .finally(() => {
    $done();
  });



async function runTask(token, index) {
  const headers = {
    'user-token': token,
    'version': version,
    'channel': '1',
    'Content-Type': 'application/json'
  };

  try {
    let activityId = await getActivityId(headers);
    if (!activityId) {
      let d1 = new Date("2025-05-01");
      let today = new Date();
      let months = (today.getFullYear() - d1.getFullYear()) * 12 + today.getMonth() - d1.getMonth();
      activityId = 59 + months;
      console.log(`未抓取到活动ID，使用备用计算ID: ${activityId}`);
    } else {
      console.log(`获取到本月签到代码: ${activityId}`);
    }

    let userInfo = await apiGet("https://sss-web.tastientech.com/api/intelligence/member/getMemberDetail", headers);
    if (!userInfo || userInfo.code !== 200) {
      let errMsg = userInfo ? userInfo.msg : '接口无返回/Token可能失效';
      console.log(`❌ 账号登录失败: ${errMsg}`);
      message += `账号[${index}]: 登录失败 (${errMsg})\n`;
      return;
    }

    let rawPhone = userInfo.result.phone;
    let phone = rawPhone.length === 11 ? rawPhone.substring(0, 3) + "****" + rawPhone.substring(7) : rawPhone;
    console.log(`账号: ${phone} 登录成功`);

    let signBody = JSON.stringify({
      "activityId": activityId,
      "memberName": "",
      "memberPhone": rawPhone
    });
    
    let signRes = await apiPost("https://sss-web.tastientech.com/api/sign/member/signV2", signBody, headers);
    
    if (signRes && signRes.code === 200) {
      let reward = signRes.result.rewardInfoList[0];
      let rewardStr = reward.rewardName ? reward.rewardName : `${reward.point} 积分`;
      console.log(`✅ 签到成功: 获得 ${rewardStr}`);
      message += `📱 ${phone}: 获得 ${rewardStr}\n`;
    } else {
      let msg = signRes ? signRes.msg : "未知错误";
      console.log(`⚠️ 签到情况: ${msg}`);
      message += `📱 ${phone}: ${msg}\n`;
    }

  } catch (e) {
    console.log(`❌ 账号[${index}]执行异常: ${e}`);
  }
}

async function getActivityId(headers) {
  let body = JSON.stringify({
    "shopId": "",
    "birthday": "",
    "gender": 0,
    "nickName": null,
    "phone": ""
  });
  
  let res = await apiPost("https://sss-web.tastientech.com/api/minic/shop/intelligence/banner/c/list", body, headers);
  
  if (res && res.result) {
    for (let item of res.result) {
      if (item.bannerName && (item.bannerName.includes("签到") || item.bannerName.includes("每日签到"))) {
        try {
          let qd = JSON.parse(item.jumpPara);
          if (qd && qd.activityId) return qd.activityId;
        } catch (e) {
          console.log(`解析 Banner 失败: ${e}`);
        }
      }
    }
  }
  return null;
}


function apiGet(url, headers) {
  return new Promise((resolve) => {
    $httpClient.get({ url, headers }, (err, resp, data) => {
      if (err) {
        resolve(null);
      } else {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      }
    });
  });
}

function apiPost(url, body, headers) {
  return new Promise((resolve) => {
    $httpClient.post({ url, body, headers }, (err, resp, data) => {
      if (err) {
        resolve(null);
      } else {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      }
    });
  });
}
