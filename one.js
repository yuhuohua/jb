/**
 * 一个one拦截开屏，弹窗广告。
 */

[Rule]
DOMAIN-KEYWORD,917api.,REJECT
DOMAIN,sc.ffsevhuy.com,REJECT
URL-REGEX,^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/ad\/space,REJECT
URL-REGEX,^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/my\/unread,REJECT

[MITM]
hostname = %APPEND% api.*.com
