---
name: connectors-basic
description: "基础连接器：天气（wttr.in）与中国节假日（holiday-cn），免 OAuth、纯 HTTP、开箱即用。当用户问'今天天气/最近几天天气/接下来有什么假期/周末是不是节假日/这周上几天班'等时使用。"
---

# Connectors Basic（基础连接器）

免登录、免 OAuth 的实用数据连接，先覆盖天气与节假日。本机 curl 因 SSL 证书问题需加 `-k`。

## 天气（wttr.in）

```bash
# 当前天气
curl -sk "https://wttr.in/?format=%l:+%c+%t+%w+%h"

# 指定城市（支持中文城市名或拼音）
curl -sk "https://wttr.in/深圳?format=%l:+%c+%t+%w+%h"
curl -sk "https://wttr.in/Shanghai?format=%l:+%c+%t+%w+%h"

# 未来 3 天（无格式参数返回完整文本）
curl -sk "https://wttr.in/?lang=zh&0" | head -40
```

- 回答时给出：城市、天气、温度、风、湿度。
- 用户问"明天天气"用 `?0`/`?1` 或 `&1` 取明日的紧凑输出（`curl -sk "https://wttr.in/?format=1"`）。

## 中国节假日（holiday-cn JSON）

```bash
YEAR=$(date +%Y)
curl -sk "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${YEAR}.json"
```

返回 JSON 结构示例（`holiday` 数组含 `name`、`date`、`rest`）:

```json
{"holiday": [{"name": "元旦", "date": "2026-01-01", "rest": true}]}
```

用法要点：
- 判断某天是否节假日：查 `date` 匹配且 `rest: true`。
- 查调休补班日：`rest: false` 的条目。
- 回答"接下来有什么假期"：过滤未来 90 天内 `rest: true` 的日期，按时间排序，说明假期名称与起止。
- 计算"这周上几天班"：排除周末 + 节假日 + 加上调休上班日。

## 日历/其他连接（后续扩展）

- iCal 数据源：`curl -sk <webcal 的 https 版>` 可抓取公开日历；解析用 venv python（`icalendar` 未装则 `pip install icalendar`）。
- 私有日历（Google Calendar / 腾讯日历）需要 OAuth，暂缓——需要时用 `openclaw mcp` 接入官方 MCP server 再授权。

## 规则

- 所有 curl 必须 `-k`（本机证书问题），且 `-m 15` 设超时。
- 天气/节假日数据都有时效性，回答时标注数据日期。
- 外部接口失败时如实说明"暂时连不上数据源"，不要编造。
