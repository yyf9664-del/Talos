"""Daily review generation and history endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.dependencies import AgentRegistryDep, DbDep, ProviderRegistryDep
from app.daily_review.service import (
    DailyReviewError,
    DailyReviewModelError,
    NoDailyReviewSourcesError,
    extract_title,
    generate_daily_review_markdown,
)
from app.models.daily_review import DailyReview
from app.schemas.daily_review import (
    DailyReviewGenerateRequest,
    DailyReviewListResponse,
    DailyReviewResponse,
)

router = APIRouter()


@router.get("/daily-reviews", response_model=list[DailyReviewListResponse])
async def list_daily_reviews(db: DbDep) -> list[DailyReviewListResponse]:
    stmt = select(DailyReview).order_by(
        DailyReview.review_date.desc(),
        DailyReview.time_created.desc(),
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [DailyReviewListResponse.model_validate(row) for row in rows]


@router.get("/daily-reviews/{review_id}", response_model=DailyReviewResponse)
async def get_daily_review(review_id: str, db: DbDep) -> DailyReviewResponse:
    review = await db.get(DailyReview, review_id)
    if review is None:
        raise HTTPException(404, "Daily review not found")
    return DailyReviewResponse.model_validate(review)


@router.post("/daily-reviews/generate", response_model=DailyReviewResponse)
async def generate_daily_review(
    body: DailyReviewGenerateRequest,
    db: DbDep,
    provider_registry: ProviderRegistryDep,
    agent_registry: AgentRegistryDep,
) -> DailyReviewResponse:
    folder_path = str(Path(body.folder_path).expanduser().resolve())
    try:
        markdown, source_files, model, provider_id = await generate_daily_review_markdown(
            folder_path=folder_path,
            review_date=body.review_date,
            provider_registry=provider_registry,
            agent_registry=agent_registry,
            model=body.model,
        )
    except NoDailyReviewSourcesError as exc:
        raise HTTPException(400, str(exc)) from exc
    except DailyReviewModelError as exc:
        raise HTTPException(503, str(exc)) from exc
    except DailyReviewError as exc:
        raise HTTPException(400, str(exc)) from exc

    review = (
        await db.execute(
            select(DailyReview).where(DailyReview.review_date == body.review_date)
        )
    ).scalar_one_or_none()
    title = extract_title(markdown, body.review_date)
    if review is None:
        review = DailyReview(
            review_date=body.review_date,
            folder_path=folder_path,
            title=title,
            content_markdown=markdown,
            source_files=source_files,
            model=model,
            provider_id=provider_id,
        )
        db.add(review)
    else:
        review.folder_path = folder_path
        review.title = title
        review.content_markdown = markdown
        review.source_files = source_files
        review.model = model
        review.provider_id = provider_id
    await db.flush()
    await db.refresh(review)
    return DailyReviewResponse.model_validate(review)


@router.delete("/daily-reviews/{review_id}")
async def delete_daily_review(review_id: str, db: DbDep) -> dict[str, bool]:
    review = await db.get(DailyReview, review_id)
    if review is not None:
        await db.delete(review)
    return {"success": True}
