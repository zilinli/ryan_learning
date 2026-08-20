# Data Analysis（数据分析与可视化 · Windows）

数据文件 → 清洗统计 → 图表 PNG → 结论。图表与结论统一放入任务目录交付。

## 前置条件

```powershell
& "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe" -c "import pandas, matplotlib; print('OK')"
```

统一用 venv：`%USERPROFILE%\.openclaw\venv\Scripts\python.exe`。

## 工作流

1. 按 `task-deliver` 规范建任务目录。
2. 把用户数据放进任务目录。
3. 写分析脚本：

```python
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial"]
plt.rcParams["axes.unicode_minus"] = False

df = pd.read_csv("数据.csv")  # 或 read_excel
print(df.info()); print(df.describe())

summary = df.groupby("分类").agg({"金额": ["sum", "mean", "count"]})
print(summary)

fig, ax = plt.subplots(figsize=(10, 5))
summary["金额"]["sum"].plot(kind="bar", ax=ax)
ax.set_title("按分类汇总")
plt.tight_layout()
plt.savefig("chart_1.png", dpi=150)
```

```powershell
cd <任务目录>
& "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe" analyze.py
```

4. 写 `结论.md` 并按 `task-deliver` 回传。

## 规则

- 图表一律 `.png`（dpi≥150），中文用 Microsoft YaHei / SimHei。
- 数据敏感时只回传统计与图表路径。
- CSV 乱码先试 `encoding="utf-8"`，再试 `"gbk"`。

## 兜底

```powershell
& "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe" -m pip install pandas matplotlib
```
