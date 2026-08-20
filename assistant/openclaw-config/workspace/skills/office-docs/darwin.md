# Office Docs（办公文档生成）

生成可交付的 Office 文档（.docx / .pptx / .pdf），补齐办公交付场景。

## 前置条件

```bash
# 检查工具（已由部署脚本安装）
$HOME/.openclaw/venv/bin/python -c "import pypandoc" 2>/dev/null || echo "缺 pypandoc"
$HOME/.openclaw/venv/bin/python -c "import pptx, docx" 2>/dev/null || echo "缺 python-pptx/python-docx"
```

python 工具统一用 venv：`~/.openclaw/venv/bin/python`（含 pypandoc(内置 pandoc 3.9)/pptx/pandas/matplotlib）。

## 工作流

1. 按 `task-deliver` 规范创建任务目录。
2. 把内容写成 Markdown（这是唯一需要认真写的内容源）。
3. 按目标格式转换。

### Word（.docx）— 用 pypandoc（内置 pandoc）

```bash
cat > build_docx.py <<'EOF'
import pypandoc
pypandoc.convert_file(
    "内容.md", "docx", outputfile="交付物.docx",
    extra_args=["--standalone", "--toc", "--metadata", "title=标题", "--metadata", "author=Bolt"]
)
EOF
$HOME/.openclaw/venv/bin/python build_docx.py
```

pandoc 二进制由 `pypandoc-binary` 随 venv 提供（本机 brew 因 SSL 不可用），无需额外安装。

### PPT（.pptx）— 用 python-pptx 脚本

```bash
cat > build_ppt.py <<'EOF'
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()
layout = prs.slide_layouts[1]  # Title + Content

def add_slide(title, bullets):
    slide = prs.slides.add_slide(layout)
    slide.shapes.title.text = title
    body = slide.placeholders[1]
    tf = body.text_frame
    tf.text = bullets[0]
    for b in bullets[1:]:
        p = tf.add_paragraph()
        p.text = b

add_slide("标题页", ["副标题一行"])
add_slide("要点 1", ["要点 A", "要点 B"])
prs.save("交付物.pptx")
EOF
$HOME/.openclaw/venv/bin/python build_ppt.py
```

### 会议纪要 / 周报模板

- 会议纪要：标题(时间/参会人) + 议题 + 结论 + 待办(负责人/期限)。
- 周报：本周完成 + 下周计划 + 风险阻塞。
直接写 Markdown 后按上面的方式转 docx 即可。

### 混合图表

需要数据图表时，先用 `data-analysis` skill 生成 `chart.png`，再用 python-pptx 把图片插入 PPT：

```python
from pptx.util import Inches
slide.shapes.add_picture("chart.png", Inches(1), Inches(2), width=Inches(8))
```

## 规则

- 转换前先用 `pypandoc.get_pandoc_version()` 确认可用；失败则退回纯 Markdown 交付并说明。
- 中文 Word 建议 `--toc`；PDF 转换依赖 LaTeX，本机未装则明确告知用户（避免长时间卡住），优先给 docx。
- 完成后按 `task-deliver` 清单回传交付物路径。
