#!/usr/bin/env python3
"""DeAPI text-to-music: submit job, poll, download mp3.

Reads DEAPI_API_KEY from ~/.openclaw/.env (quoted values supported).
Uses curl -k because this Mac's Python SSL certs fail against api.deapi.ai.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ENV_PATH = Path.home() / ".openclaw" / ".env"
API = "https://api.deapi.ai"
DEFAULT_MODEL = "AceStep_1_5_Turbo"


def load_env():
    if not ENV_PATH.exists():
        return
    for raw in ENV_PATH.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip("'").strip('"')
        os.environ.setdefault(k.strip(), v)


def curl_json(method, url, form=None, timeout=60):
    key = os.environ.get("DEAPI_API_KEY") or ""
    if not key:
        raise SystemExit("缺少 DEAPI_API_KEY，请写入 ~/.openclaw/.env")
    cmd = [
        "curl", "-sk", "-m", str(timeout),
        "-X", method, url,
        "-H", "Authorization: Bearer %s" % key,
        "-H", "Accept: application/json",
    ]
    if form:
        for k, v in form:
            cmd.extend(["-F", "%s=%s" % (k, v)])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit("curl 失败: %s" % (proc.stderr or proc.stdout)[-400:])
    try:
        return json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        raise SystemExit("非 JSON 响应: %s" % proc.stdout[:400])


def download(url, dest, timeout=120):
    cmd = ["curl", "-skL", "-m", str(timeout), "-o", dest, url]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) < 100:
        raise SystemExit("下载失败: %s" % (proc.stderr or "")[-400:])


def main():
    p = argparse.ArgumentParser(description="DeAPI 文生曲")
    p.add_argument("--caption", required=True, help="风格描述（英文更稳，3-300 字符）")
    p.add_argument("--lyrics", default="[Instrumental]", help="歌词；纯器乐用 [Instrumental]")
    p.add_argument("--out", required=True, help="输出 mp3 路径")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--duration", type=int, default=30)
    p.add_argument("--bpm", type=int, default=0, help="0 表示不指定")
    p.add_argument("--keyscale", default="")
    p.add_argument("--timesignature", type=int, default=0, help="2/3/4/6，0 不指定")
    p.add_argument("--vocal-language", default="", dest="vocal_language")
    p.add_argument("--steps", type=int, default=8)
    p.add_argument("--guidance", type=float, default=1.0)
    p.add_argument("--seed", type=int, default=-1)
    p.add_argument("--format", default="mp3")
    p.add_argument("--poll-sec", type=int, default=8)
    p.add_argument("--timeout-sec", type=int, default=240)
    args = p.parse_args()

    load_env()
    caption = args.caption.strip()
    if len(caption) < 3:
        raise SystemExit("caption 太短")
    if len(caption) > 300:
        caption = caption[:300]

    form = [
        ("caption", caption),
        ("model", args.model),
        ("lyrics", args.lyrics.strip() or "[Instrumental]"),
        ("duration", str(args.duration)),
        ("inference_steps", str(args.steps)),
        ("guidance_scale", str(args.guidance)),
        ("seed", str(args.seed)),
        ("format", args.format),
    ]
    if args.bpm:
        form.append(("bpm", str(args.bpm)))
    if args.keyscale:
        form.append(("keyscale", args.keyscale))
    if args.timesignature in (2, 3, 4, 6):
        form.append(("timesignature", str(args.timesignature)))
    if args.vocal_language:
        form.append(("vocal_language", args.vocal_language))

    print("submit model=%s duration=%s" % (args.model, args.duration), flush=True)
    resp = curl_json("POST", API + "/api/v2/audio/music", form=form)
    rid = ((resp.get("data") or {}).get("request_id")) or resp.get("request_id")
    if not rid:
        raise SystemExit("提交失败: %s" % json.dumps(resp, ensure_ascii=False)[:800])
    print("request_id=%s" % rid, flush=True)

    deadline = time.time() + args.timeout_sec
    last = None
    while time.time() < deadline:
        last = curl_json("GET", API + "/api/v2/jobs/" + rid, timeout=30)
        data = last.get("data") or last
        status = (data.get("status") or "").lower()
        progress = data.get("progress")
        print("status=%s progress=%s" % (status, progress), flush=True)
        if status in ("done", "completed", "success"):
            url = data.get("result_url") or data.get("result")
            if isinstance(url, dict):
                url = url.get("url") or url.get("result_url")
            if not url:
                raise SystemExit("完成但没有 result_url: %s" % json.dumps(last, ensure_ascii=False)[:800])
            os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
            download(str(url), args.out)
            print("saved %s (%s bytes)" % (args.out, os.path.getsize(args.out)), flush=True)
            return
        if status in ("failed", "error", "cancelled"):
            raise SystemExit("生成失败: %s" % json.dumps(last, ensure_ascii=False)[:800])
        time.sleep(args.poll_sec)
    raise SystemExit("超时，最后状态: %s" % json.dumps(last or {}, ensure_ascii=False)[:800])


if __name__ == "__main__":
    sys.exit(main())
