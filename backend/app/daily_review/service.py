"""Daily review file collection and LLM generation service."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from app.agent.agent import AgentRegistry
from app.provider.registry import ProviderRegistry

SUPPORTED_EXTENSIONS = {
    ".md",
    ".markdown",
    ".txt",
    ".org",
    ".json",
    ".csv",
    ".log",
    ".yaml",
    ".yml",
}
IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".nuxt",
    ".cache",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
}
DEFAULT_MAX_FILES = 50
DEFAULT_MAX_FILE_BYTES = 80 * 1024
DEFAULT_MAX_TOTAL_CHARS = 300 * 1024


class DailyReviewError(RuntimeError):
    """Base class for daily review generation errors."""


class NoDailyReviewSourcesError(DailyReviewError):
    """Raised when no readable files are found for the selected day."""


class DailyReviewModelError(DailyReviewError):
    """Raised when no usable LLM model can be resolved."""


@dataclass(frozen=True)
class DailyReviewSource:
    path: str
    relative_path: str
    modified_at: str
    content: str
    size: int
    truncated: bool

    def metadata(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("content", None)
        return data


def collect_daily_review_sources(
    folder_path: str | Path,
    review_date: date,
    *,
    max_files: int = DEFAULT_MAX_FILES,
    max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
    max_total_chars: int = DEFAULT_MAX_TOTAL_CHARS,
) -> list[DailyReviewSource]:
    """Collect readable files modified on ``review_date`` in local time."""

    root = Path(folder_path).expanduser().resolve()
    if not root.is_dir():
        raise NoDailyReviewSourcesError("No readable files found for this day.")

    candidates: list[tuple[float, Path]] = []
    for dirpath, dirnames, filenames in root.walk():
        dirnames[:] = [
            name
            for name in dirnames
            if name not in IGNORED_DIRS and not name.startswith(".")
        ]
        for filename in filenames:
            path = dirpath / filename
            if path.name.startswith(".") or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            modified = datetime.fromtimestamp(stat.st_mtime)
            if modified.date() == review_date:
                candidates.append((stat.st_mtime, path))

    candidates.sort(key=lambda item: item[0])
    sources: list[DailyReviewSource] = []
    remaining_chars = max_total_chars

    for _, path in candidates[:max_files]:
        if remaining_chars <= 0:
            break
        try:
            stat = path.stat()
            raw = _read_limited_bytes(path, max_file_bytes)
        except OSError:
            continue
        truncated = stat.st_size > max_file_bytes
        text = raw.decode("utf-8", errors="replace").strip()
        if not text:
            continue
        if len(text) > remaining_chars:
            text = text[:remaining_chars].rstrip()
            truncated = True
        remaining_chars -= len(text)
        sources.append(
            DailyReviewSource(
                path=str(path.resolve()),
                relative_path=path.relative_to(root).as_posix(),
                modified_at=datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                content=text,
                size=stat.st_size,
                truncated=truncated,
            )
        )

    if not sources:
        raise NoDailyReviewSourcesError("No readable files found for this day.")
    return sources


async def generate_daily_review_markdown(
    *,
    folder_path: str | Path,
    review_date: date,
    provider_registry: ProviderRegistry,
    agent_registry: AgentRegistry,
    model: str | None = None,
) -> tuple[str, list[dict[str, Any]], str, str]:
    """Generate diary-style markdown and return markdown, source metadata, model, provider."""

    sources = collect_daily_review_sources(folder_path, review_date)
    provider, model_info = await _resolve_model(provider_registry, model)
    agent = agent_registry.get("daily_review")
    if agent is None or not agent.system_prompt:
        raise DailyReviewModelError("Daily review agent is not available.")

    messages = [
        {
            "role": "user",
            "content": _format_generation_prompt(
                folder_path=str(Path(folder_path).expanduser().resolve()),
                review_date=review_date,
                sources=sources,
            ),
        }
    ]

    markdown = ""
    async for chunk in provider.stream_chat(
        model_info.id,
        messages,
        system=agent.system_prompt,
        temperature=agent.temperature,
        max_tokens=4096,
    ):
        if chunk.type == "text-delta":
            markdown += chunk.data.get("text", "")
        elif chunk.type == "error":
            message = chunk.data.get("message") or "Daily review generation failed."
            raise DailyReviewModelError(str(message))

    markdown = markdown.strip()
    if not markdown:
        raise DailyReviewModelError("Daily review generation returned no content.")

    return (
        markdown,
        [source.metadata() for source in sources],
        model_info.id,
        provider.id,
    )


def extract_title(markdown: str, review_date: date) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip()
            if title:
                return title[:160]
    return f"{review_date.isoformat()} 每日回顾"


def _read_limited_bytes(path: Path, max_bytes: int) -> bytes:
    with path.open("rb") as file:
        return file.read(max_bytes + 1)[:max_bytes]


async def _resolve_model(provider_registry: ProviderRegistry, model: str | None):
    model_id = model
    if not model_id:
        models = provider_registry.all_models()
        if not models and hasattr(provider_registry, "refresh_models"):
            await provider_registry.refresh_models()
            models = provider_registry.all_models()
        if not models:
            raise DailyReviewModelError("No model available for daily review generation.")
        model_id = models[0].id

    resolved = provider_registry.resolve_model(model_id)
    if resolved is None and hasattr(provider_registry, "refresh_models"):
        await provider_registry.refresh_models()
        resolved = provider_registry.resolve_model(model_id)
    if resolved is None:
        raise DailyReviewModelError(f"Model not found: {model_id}")
    return resolved


def _format_generation_prompt(
    *,
    folder_path: str,
    review_date: date,
    sources: list[DailyReviewSource],
) -> str:
    parts = [
        f"日期：{review_date.isoformat()}",
        f"文件夹：{folder_path}",
        "",
        "下面是当天修改过的文件内容。请只基于这些素材生成每日回顾。",
    ]
    for index, source in enumerate(sources, 1):
        parts.extend(
            [
                "",
                f"## 素材 {index}: {source.relative_path}",
                f"- 修改时间：{source.modified_at}",
                f"- 是否截断：{'是' if source.truncated else '否'}",
                "",
                source.content,
            ]
        )
    return "\n".join(parts)
