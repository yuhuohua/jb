[filter_local]
host-keyword, 917api., reject
host, sc.ffsevhuy.com, reject

[rewrite_local]
^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/ad\/space url reject-200
^https?:\/\/api\.[a-z0-9-]+\.com\/v2\.5\/my\/unread url reject-200

[mitm]
hostname = api.*.com
