/**
 * 一个one拦截开屏，弹窗广告。
 */

[filter_local]
host-keyword, 917api., reject
host, sc.ffsevhuy.com, reject

[rewrite_local]
^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/ad\/space url reject
^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/my\/unread url reject

[mitm]
hostname = api.*.com
