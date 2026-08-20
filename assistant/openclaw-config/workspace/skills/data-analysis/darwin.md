# Data Analysis（数据分析与可视化）

数据文件 → 清洗统计 → 图表 PNG → 结论。图表与结论统一放入任务目录交付。

## 前置条件

```bash
$HOME/.openclaw/venv/bin/python -c "import pandas, matplotlib" 2>/dev/null || echo "缺依赖"
```

统一用 venv：`~/.openclaw/venv/bin/python`（含 pandas/matplotlib/python-pptx）。

## 工作流

1. 按 `task-deliver` 规范建任务目录。
2. 把用户数据（本地文件路径，或用户粘贴的内容写入文件）放进任务目录。
3. 写分析脚本：

```python
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "Hiragino Sans GB", "Songti SC"]  # macOS 中文字体

df = pd.read_csv("数据.csv")  # 或 read_excel
print(df.info()); print(df.describe())

# 按需清洗：去重、缺失值、类型转换
# 分组统计示例
summary = df.groupby("分类").agg({"金额": ["sum", "mean", "count"]})
print(summary)

# 出图
fig, ax = plt.subplots(figsize=(10, 5))
summary["金额"]["sum"].plot(kind="bar", ax=ax)
ax.set_title("按分类汇总")
plt.tight_layout()
plt.savefig("chart_1.png", dpi=150)
```

```bash
cd <任务目录>
$HOME/.openclaw/venv/bin/python analyze.py
```

4. 写 `结论.md`：数据概览 + 关键发现（3-5 条）+ 图表说明 + 异常/注意事项。
5. 交付：微信回传结论摘要 + 产物路径（按 `task-deliver` 清单）。

## 常见分析方法

| 场景 | 做法 |
|---|---|
| 趋势 | 时间序列折线图 `df.set_index("日期")["值"].plot()` |
| 分布 | 直方图 `hist()` / 箱线图 `boxplot()` |
| 对比 | 分组柱状图 / 饼图 |
| 相关性 | `df.corr()` + heatmap |
| 汇总 | `groupby().agg()` / 透视表 `pivot_table` |

## 规则

- 图表一律 `.png`（dpi≥150），中文用 macOS 自带中文字体。
- 数据敏感时只回传统计结果与图表，不回传原始数据全量。
- 数据量很大（>5MB）先说明可能较慢，可抽样分析并注明。
- 微信只发结论与路径，图表文件路径列出（微信客户端无法直接打开本地文件时说明）。

## 兜底

- 缺 pandas/matplotlib 时 `$HOME/.openclaw/venv/bin/pip install pandas matplotlib`。
- 编码问题（CSV 乱码）先试 `encoding="utf-8"`，再试 `"gbk"`。
