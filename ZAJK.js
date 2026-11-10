/**
 * 众安健康（微信小程序）
 * 功能：每日签到 / 浏览任务 / 领取奖励 / 满 5 元自动提现
 *
 * 通用脚本，支持：Surge / Loon / QuantumultX / Node（青龙、VPS）
 *
 * ── 变量 ──────────────────────────────────────────────
 * 变量名：ZAJK_token
 * 变量格式：Access-Token（当前接口只用它鉴权，不需要 Cookie）
 * 兼容旧格式：Access-Token&Cookie，& 后面的部分会被忽略
 * 多账号：换行 或 # 分隔
 *
 * ── 自动抓取 ──────────────────────────────────────────
 * 打开小程序「众安健康」，进首页就会发请求
 * 脚本自动提取 Access-Token 累加写入多账号池，不用手动拼凑
 * 抓取成功后弹通知，之后可以把「抓取开关」填 # 关掉
 */

const NAME = '众安健康';
const $ = new Env(NAME);

// ===== 可调参数 =====
const MANUAL_TOKEN = '';   // 手动兜底填这里：Access-Token，多账号用换行
const NOTIFY = true;       // 是否开启通知总开关
const DEBUG = false;       // 是否打印请求/响应明细
const WITHDRAW_ENABLE = true; // 自动提现总开关

const ACTIVITY_CODE = 'ONA20220411001';
const CHANNEL_CODE = 'c20195660470001';  
const TASK_CHANNEL_CODE = '1000000004';  
const TASK_ID = '110';
const WITHDRAW_AMOUNT = 500;             // 5 元 (500 分)
const MAX_TASK = 3;                      

const API = {
	home: 'https://ihealth.zhongan.com/api/lemon/v1/common/activity/homePage',
	sign: 'https://ihealth.zhongan.com/api/lemon/v1/common/activity/signIn',
	award: 'https://ihealth.zhongan.com/api/lemon/v1/applet/mgm/activity/add/award',
	lottery: 'https://ihealth.zhongan.com/api/lemon/v1/common/activity/lottery',
	withdraw: 'https://ihealth.zhongan.com/api/lemon/v1/common/activity/withdraw'
};

const HOME_BODY = JSON.stringify({
	activityCode: ACTIVITY_CODE,
	channelCode: CHANNEL_CODE
});

const UA_WX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.23(0x1800172f) NetType/WIFI Language/zh_CN';

const IS_NODE = $.isNode();
const WAIT_MIN = IS_NODE ? 6000 : 500;
const WAIT_MAX = IS_NODE ? 8000 : 1000;

// ===== 入口 =====
(async () => {
	if (typeof $request !== 'undefined') {
		handleRequest();
		return;
	}
	await main();
})()
	.catch((e) => console.log(`❌ [${NAME}] 运行异常：${e && e.message ? e.message : e}`))
	.finally(() => {
		if (typeof $request === 'undefined') $.done({});
	});

// ===== 主流程 =====
async function main() {
	const accounts = getAccounts();
	if (!accounts.length) {
		console.log('💊 [众安健康] 未找到账号，请配置 ZAJK_token，或先打开小程序抓取凭证');
		notify('💊 众安健康 · 账号提醒', '⚠️ 未找到有效账号，请配置 ZAJK_token 或打开小程序抓取凭证！');
		return;
	}

	console.log(`💊 [众安健康] 共找到 ${accounts.length} 个账号 | 自动提现状态: ${withdrawEnabled() ? '🟢 开启' : '🔴 关闭'}`);
	
	const allAccountLogs = [];

	for (let i = 0; i < accounts.length; i++) {
		const accountTitle = `================ 👤 第 ${i + 1} 个账号 ===============`;
		console.log(`\n${accountTitle}`);
		const lines = await runAccount(accounts[i], i + 1);
		
		let blockText = [accountTitle];
		lines.forEach(l => {
			console.log(l);
			blockText.push(l);
		});
		allAccountLogs.push(blockText.join('\n'));
	}

	console.log(`\n💊 [众安健康] 所有账号执行完毕`);
	
	if (NOTIFY) {
		const summaryBody = allAccountLogs.join('\n\n');
		notify('💊 众安健康 · 运行报告', summaryBody);
	}
}

async function runAccount(raw, index) {
	const lines = [];
	const addLog = (text) => {
		const timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(Date.now()).slice(-6);
		const logLine = `${timeStr} [账号${index}] ${text}`;
		lines.push(logLine);
	};

	const pos = raw.indexOf('&');
	const at = (pos === -1 ? raw : raw.slice(0, pos)).trim();

	if (!at) {
		addLog(`❌ 账号 ${index} 缺少 Access-Token`);
		return lines;
	}

	const tokenHeader = buildTokenHeader(at);

	// 1. 用户信息 
	const home = await request('post', API.home, tokenHeader, HOME_BODY, '用户信息');
	if (!isOk(home)) {
		addLog(`❌ CK 失效`);
		saveResult(false);
		return lines;
	}
	await randWait();

	// 2. 签到
	const sign = await request('post', API.sign, tokenHeader, HOME_BODY, '签到');
	if (isOk(sign)) {
		const t = sign.result && sign.result.type;
		addLog(`✨ 签到状态：${t === 1 ? '📅 今日已签到' : '🎉 签到成功'}`);
	} else {
		addLog(`⚠️ 签到提示：${errText(sign)}`);
	}
	await randWait();

	// 3. 浏览任务
	const goods = getTaskGoods(home);
	if (!goods.length) {
		addLog(`ℹ️ 暂无可做的浏览任务`);
	} else {
		const total = Math.min(goods.length, MAX_TASK);
		let success = 0;
		for (let i = 0; i < total; i++) {
			const res = await request('post', API.award, tokenHeader, {
				activityCode: ACTIVITY_CODE,
				channelCode: TASK_CHANNEL_CODE,
				goodsCode: goods[i],
				taskId: TASK_ID
			}, `浏览任务${i + 1}`);
			if (isOk(res)) success++;
			await randWait();
		}
		addLog(`🎯 浏览任务：成功 ${success}/${total}`);
	}

	// 4. 领取奖励（抽奖）
	const home2 = await request('post', API.home, tokenHeader, HOME_BODY, '用户信息-领奖');
	if (home2 && home2.result) {
		const rewards = home2.result.valuableRewardList || [];
		let got = 0;
		for (let i = 0; i < rewards.length; i++) {
			const rawId = rewards[i] && rewards[i].awardDetailId;
			if (rawId === undefined || rawId === null) continue;
			const res = await request('post', API.lottery, tokenHeader, {
				channelCode: CHANNEL_CODE,
				activityCode: ACTIVITY_CODE,
				id: toId(rawId)
			}, `领奖${i + 1}`);
			if (isOk(res)) got++;
			await randWait();
		}
		if (rewards.length) addLog(`🎁 领奖结果：成功 ${got}/${rewards.length}`);
	}

	// 5. 提现
	const home3 = await request('post', API.home, tokenHeader, HOME_BODY, '用户信息-提现');
	const result = (home3 && home3.result) || {};
	const sumAward = toNumber(result.sumAward);
	const allow = toNumber(result.sumAllowWithdraw);
	
	const sumAwardYuan = (sumAward / 100).toFixed(2);
	const allowYuan = (allow / 100).toFixed(2);
	addLog(`💰 累计金额: ${sumAwardYuan} 元 | 可提现金额: ${allowYuan} 元`);

	if (!withdrawEnabled()) {
		addLog(`🔒 自动提现已关闭`);
	} else if (allow >= WITHDRAW_AMOUNT) {
		const res = await request('post', API.withdraw, tokenHeader, {
			channelCode: CHANNEL_CODE,
			activityCode: ACTIVITY_CODE,
			amount: WITHDRAW_AMOUNT
		}, '提现');
		if (isOk(res)) {
			addLog(`🎉 提现 5 元成功，请前往微信查看！`);
		} else {
			addLog(`❌ 提现失败：${errText(res)}`);
		}
	} else if (allow > 0) {
		addLog(`⏳ 未满 5 元（当前 ${allowYuan} 元），暂不提现`);
	} else {
		addLog(`ℹ️ 暂无可提现金额`);
	}

	saveResult(true);
	return lines;
}

// ===== 请求 =====
function request(method, url, headers, body, tag) {
	return new Promise((resolve) => {
		const opt = {
			url: url,
			headers: Object.assign({}, headers),
			timeout: 15000
		};
		if (body !== undefined && body !== null) {
			opt.body = typeof body === 'string' ? body : JSON.stringify(body);
		}

		if (DEBUG) console.log(`[${tag}] -> ${url} ${opt.body || ''}`);

		$[method](opt, (err, resp, data) => {
			if (err) {
				console.log(`[${tag}] 请求异常：${JSON.stringify(err)}`);
				resolve(null);
				return;
			}
			if (!data) {
				console.log(`[${tag}] 返回为空`);
				resolve(null);
				return;
			}
			let json = null;
			try {
				json = typeof data === 'string' ? JSON.parse(data) : data;
			} catch (e) {
				console.log(`[${tag}] 解析失败：${String(data).slice(0, 200)}`);
			}
			if (DEBUG && json) console.log(`[${tag}] <- ${JSON.stringify(json)}`);
			resolve(json);
		});
	});
}

function buildTokenHeader(at) {
	return {
		'Host': 'ihealth.zhongan.com',
		'Connection': 'keep-alive',
		'Access-Token': at,
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		'Accept-Encoding': 'gzip, compress, br, deflate',
		'User-Agent': UA_WX,
		'Referer': 'https://servicewechat.com/wxbac45cc1588a5a75/210/page-frame.html'
	};
}

// ===== 多账号凭证自动抓取 =====
function handleRequest() {
	try {
		const url = ($request && $request.url) || '';
		if (url.indexOf('ihealth.zhongan.com') === -1) {
			$done({});
			return;
		}
		const headers = ($request && $request.headers) || {};
		const at = pickHeader(headers, 'Access-Token') || pickHeader(headers, 'access-token');
		
		if (at && at.length > 50) {
			let existingRaw = readStore('ZAJK_token') || '';
			let list = existingRaw.split(/[\n#]+/).map(s => s.trim()).filter(Boolean);
			
			let exists = list.some(item => {
				let pos = item.indexOf('&');
				let existingToken = (pos === -1 ? item : item.slice(0, pos)).trim();
				return existingToken === at;
			});
			
			if (!exists) {
				list.push(at);
				const newRaw = list.join('\n');
				writeStore('ZAJK_token', newRaw);
				console.log(`✅ 成功捕获新账号 Access-Token 并已存入多账号池 (当前共 ${list.length} 个账号)`);
				notify('💊 众安健康 · 抓取成功', `✨ 成功捕获并保存新账号凭证！当前共 ${list.length} 个账号`);
			} else {
				console.log(`ℹ️ 当前账号 Access-Token 已存在，跳过重复存储`);
			}
		}
	} catch (e) {
		console.log(`抓取异常：${e && e.message ? e.message : e}`);
	}
	$done({});
}

function pickHeader(headers, name) {
	if (!headers) return '';
	if (headers[name]) return headers[name];
	const lower = name.toLowerCase();
	const keys = Object.keys(headers);
	for (let i = 0; i < keys.length; i++) {
		if (keys[i].toLowerCase() === lower) return headers[keys[i]];
	}
	return '';
}

// ===== 账号获取 =====
function getAccounts() {
	let raw = '';
	const args = getArgument();
	if (args.ZAJK_token) raw = args.ZAJK_token;
	if (!raw) raw = readStore('ZAJK_token');
	if (!raw) raw = MANUAL_TOKEN;
	return splitAccounts(raw);
}

function splitAccounts(raw) {
	if (!raw) return [];
	return String(raw)
		.replace(/\r/g, '')
		.split(/[\n#]+/)
		.map((s) => s.trim())
		.filter((s) => s && s.length >= 20);
}

function getArgument() {
	if (typeof $argument === 'undefined' || !$argument) return {};
	const out = {};
	const raw = String($argument).trim();

	if (raw.charAt(0) === '{') {
		try {
			const obj = JSON.parse(raw);
			Object.keys(obj).forEach((k) => {
				out[k] = obj[k] === null || obj[k] === undefined ? '' : String(obj[k]);
			});
			return out;
		} catch (e) {}
	}

	raw.split('&').forEach((pair) => {
		const i = pair.indexOf('=');
		if (i < 1) return;
		const k = pair.slice(0, i).trim();
		let v = pair.slice(i + 1);
		try { v = decodeURIComponent(v); } catch (e) {}
		out[k] = v;
	});
	return out;
}

function withdrawEnabled() {
	const args = getArgument();
	let v = args['withdraw'] !== undefined ? args['withdraw'] : args['提现开关'];
	if (v === undefined || v === '') v = readStore('ZAJK_withdraw');
	if (v === undefined || v === null || v === '') return WITHDRAW_ENABLE;
	const s = String(v).trim().toLowerCase();
	return !(s === '0' || s === 'false' || s === 'off' || s === 'no' || s === '关' || s === '否');
}

function readStore(key) {
	try {
		const v = $.getval(key);
		return v === null || v === undefined ? '' : String(v);
	} catch (e) { return ''; }
}

function writeStore(key, value) {
	try { return $.setval(value, key); } catch (e) { return false; }
}

function isOk(res) {
	return !!res && String(res.code) === '0';
}

function errText(res) {
	if (!res) return '无返回';
	return res.message || res.msg || res.errorMsg || `code=${res.code}`;
}

function getTaskGoods(home) {
	const out = [];
	try {
		const res = (home && home.result) || {};
		const list = res.productRecommendList || [];
		for (let i = 0; i < list.length; i++) {
			const item = list[i];
			if (item && item.status === true && item.goodsCode) out.push(String(item.goodsCode));
		}
		if (out.length) return out;

		const obj = res.productRecommend || {};
		Object.keys(obj).forEach((k) => {
			const v = obj[k];
			if (!v || v.status !== false) out.push(k);
		});
	} catch (e) {}
	return out;
}

function toNumber(v) {
	const n = Number(v);
	return isFinite(n) ? n : 0;
}

function toId(v) {
	const s = String(v);
	return /^\d+$/.test(s) ? Number(s) : v;
}

function randWait() {
	const ms = Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1)) + WAIT_MIN;
	return $.wait(ms);
}

function notify(title, body) {
	if (!NOTIFY) return;
	$.msg(title, '', body);
}

function saveResult(ok) {
	if (!IS_NODE) return;
	try {
		const fs = require('fs');
		const line = `${ok ? '✅' : '❌'}【${NAME}】 | ${ok ? 'CK正常' : 'CK已失效'}\n`;
		fs.appendFileSync('script_results.txt', line, 'utf8');
	} catch (e) {}
}

// ===== Env =====
function Env(name) {
	const IS_NODE_ENV = typeof module !== 'undefined' && !!module.exports;
	const IS_QUANX_ENV = typeof $task !== 'undefined';
	const IS_SURGE_ENV = typeof $httpClient !== 'undefined' && typeof $loon === 'undefined';
	const IS_LOON_ENV = typeof $loon !== 'undefined';

	return new class {
		constructor(n) {
			this.name = n;
			this.startTime = Date.now();
			this.data = null;
			this.dataFile = 'box.dat';
		}

		isNode() { return IS_NODE_ENV; }
		isQuanX() { return IS_QUANX_ENV; }
		isSurge() { return IS_SURGE_ENV; }
		isLoon() { return IS_LOON_ENV; }

		getval(key) {
			if (IS_SURGE_ENV || IS_LOON_ENV) return $persistentStore.read(key);
			if (IS_QUANX_ENV) return $prefs.valueForKey(key);
			if (IS_NODE_ENV) {
				if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
				this.data = this.loaddata();
				return this.data ? this.data[key] : null;
			}
			return null;
		}

		setval(value, key) {
			if (IS_SURGE_ENV || IS_LOON_ENV) return $persistentStore.write(value, key);
			if (IS_QUANX_ENV) return $prefs.setValueForKey(value, key);
			if (IS_NODE_ENV) {
				this.data = this.loaddata();
				this.data[key] = value;
				this.writedata();
				return true;
			}
			return false;
		}

		getdata(key) { return this.getval(key); }
		setdata(value, key) { return this.setval(value, key); }

		loaddata() {
			try {
				const fs = require('fs');
				const path = require('path');
				const p1 = path.resolve(this.dataFile);
				const target = fs.existsSync(p1) ? p1 : path.resolve(process.cwd(), this.dataFile);
				if (!fs.existsSync(target)) return {};
				return JSON.parse(fs.readFileSync(target, 'utf8')) || {};
			} catch (e) { return {}; }
		}

		writedata() {
			try {
				const fs = require('fs');
				const path = require('path');
				const p1 = path.resolve(this.dataFile);
				const target = fs.existsSync(p1) ? p1 : path.resolve(process.cwd(), this.dataFile);
				fs.writeFileSync(target, JSON.stringify(this.data || {}));
			} catch (e) {}
		}

		nodeRequest(method, opt) {
			return new Promise((resolve, reject) => {
				const options = { method: method, headers: opt.headers, body: opt.body, timeout: opt.timeout || 15000 };
				let got = null;
				try { got = require('got'); } catch (e) { got = null; }
				if (got && typeof got === 'function') {
					got(opt.url, Object.assign({}, options, { throwHttpErrors: false, retry: 0 }))
						.then((r) => resolve({ statusCode: r.statusCode, headers: r.headers, body: r.body }))
						.catch(reject);
					return;
				}
				try {
					const axios = require('axios');
					axios({ url: opt.url, method: method, headers: opt.headers, data: opt.body, timeout: opt.timeout || 15000, validateStatus: () => true })
						.then((r) => resolve({ statusCode: r.status, headers: r.headers, body: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) }))
						.catch(reject);
				} catch (e) {
					this.rawRequest(method, opt).then(resolve).catch(reject);
				}
			});
		}

		rawRequest(method, opt) {
			return new Promise((resolve, reject) => {
				try {
					const http = require('http');
					const https = require('https');
					const u = new URL(opt.url);
					const lib = u.protocol === 'http:' ? http : https;
					const headers = Object.assign({}, opt.headers, { 'Accept-Encoding': 'identity' });
					const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, method: method, headers: headers, timeout: opt.timeout || 15000 }, (res) => {
						const chunks = [];
						res.on('data', (c) => chunks.push(c));
						res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
					});
					req.on('error', reject);
					req.on('timeout', () => req.destroy(new Error('请求超时')));
					if (opt.body) req.write(opt.body);
					req.end();
				} catch (e) { reject(e); }
			});
		}

		get(opt, cb = () => {}) {
			if (IS_SURGE_ENV || IS_LOON_ENV) {
				$httpClient.get(opt, (err, resp, body) => {
					if (!err && resp) { resp.body = body; resp.statusCode = resp.status; }
					cb(err, resp, body);
				});
			} else if (IS_QUANX_ENV) {
				$task.fetch(Object.assign({}, opt, { method: 'GET' })).then((r) => cb(null, r, r.body), (e) => cb(e));
			} else {
				this.nodeRequest('GET', opt).then((r) => cb(null, r, r.body), (e) => cb(e));
			}
		}

		post(opt, cb = () => {}) {
			if (opt.headers) delete opt.headers['Content-Length'];
			if (IS_SURGE_ENV || IS_LOON_ENV) {
				$httpClient.post(opt, (err, resp, body) => {
					if (!err && resp) { resp.body = body; resp.statusCode = resp.status; }
					cb(err, resp, body);
				});
			} else if (IS_QUANX_ENV) {
				$task.fetch(Object.assign({}, opt, { method: 'POST' })).then((r) => cb(null, r, r.body), (e) => cb(e));
			} else {
				this.nodeRequest('POST', opt).then((r) => cb(null, r, r.body), (e) => cb(e));
			}
		}

		msg(title, subtitle = '', body = '', opts) {
			if (IS_SURGE_ENV || IS_LOON_ENV) {
				$notification.post(title, subtitle, body, opts);
			} else if (IS_QUANX_ENV) {
				$notify(title, subtitle, body, opts);
			} else {
				console.log(['', '============== 📣 通知 📣==============', title, subtitle, body].join('\n'));
			}
		}

		log(...args) { console.log(args.join(' ')); }
		logErr(e, resp) { console.log('', `❗️ ${this.name} 错误!`, e && e.stack ? e.stack : e, resp || ''); }
		wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
		done(value = {}) {
			const cost = ((Date.now() - this.startTime) / 1000).toFixed(1);
			console.log(`🔔 [${this.name}] 结束，耗时 ${cost} 秒`);
			if (IS_SURGE_ENV || IS_LOON_ENV || IS_QUANX_ENV) $done(value);
		}
	}(name);
}
