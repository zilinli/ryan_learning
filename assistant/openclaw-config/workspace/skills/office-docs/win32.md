# Office Docs（办公文档生成 · Windows）

## 前置条件

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
& $py -c "import pypandoc; print('pypandoc OK')"
& $py -c "import pptx; print('pptx OK')"
```

统一用：`%USERPROFILE%\.openclaw\venv\Scripts\python.exe`（含 pypandoc-binary / python-pptx）。

## 工作流

1. 按 `task-deliver` 创建任务目录。
2. 把内容写成 Markdown。
3. 转换：

### Word（.docx）

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
@'
import pypandoc
pypandoc.convert_file(
    "内容.md", "docx", outputfile="交付物.docx",
    extra_args=["--standalone", "--toc", "--metadata", "title=标题", "--metadata", "author=Bolt"]
)
'@ | Set-Content -Encoding UTF8 build_docx.py
& $py build_docx.py
```

### PPT（.pptx）

用 `python-pptx` 按页创建标题/正文/要点；脚本落在任务目录后用同一 venv 运行。

## 规则

- 先 Markdown 源，再派生 Office 文件，便于修订。
- 交付时同时给出 `.md` 与 `.docx`/`.pptx` 路径。
