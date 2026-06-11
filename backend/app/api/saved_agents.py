from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_agent_registry, get_db, get_index_manager, get_provider_registry,
    get_session_factory, get_stream_manager, get_tool_registry,
)
from app.saved_agent.form_schema import (
    validate_form_schema, validate_identifier, validate_inputs,
)
from app.saved_agent.runner import launch_run
from app.saved_agent.storage import (
    get_saved_agent, list_saved_agents, upsert_saved_agent,
)
from app.schemas.saved_agent import (
    RunRequest, RunResponse, SavedAgentCreate, SavedAgentResponse, SavedAgentUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/saved-agents", response_model=list[SavedAgentResponse])
async def list_agents(workspace: str, db: AsyncSession = Depends(get_db)):
    return await list_saved_agents(db, workspace_path=workspace)


@router.post("/saved-agents", response_model=SavedAgentResponse)
async def create_agent(body: SavedAgentCreate, db: AsyncSession = Depends(get_db)):
    id_err = validate_identifier(body.identifier)
    if id_err:
        raise HTTPException(422, detail=id_err)
    errs = validate_form_schema(body.form_schema)
    if errs:
        raise HTTPException(422, detail="Invalid form_schema: " + "; ".join(errs))
    agent = await upsert_saved_agent(
        db, workspace_path=body.workspace_path, identifier=body.identifier,
        title=body.title, description=body.description, skill_content=body.skill_content,
        form_schema=body.form_schema, memory_schema=body.memory_schema,
        source_session_id=body.source_session_id,
    )
    await db.flush()
    return agent


@router.get("/saved-agents/{agent_id}", response_model=SavedAgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    return agent


@router.put("/saved-agents/{agent_id}", response_model=SavedAgentResponse)
async def update_agent(agent_id: str, body: SavedAgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    if body.form_schema is not None:
        errs = validate_form_schema(body.form_schema)
        if errs:
            raise HTTPException(422, detail="Invalid form_schema: " + "; ".join(errs))
    agent = await upsert_saved_agent(
        db, workspace_path=agent.workspace_path, identifier=agent.identifier,
        title=body.title if body.title is not None else agent.title,
        description=body.description if body.description is not None else agent.description,
        skill_content=body.skill_content if body.skill_content is not None else agent.skill_content,
        form_schema=body.form_schema if body.form_schema is not None else agent.form_schema,
        memory_schema=body.memory_schema if body.memory_schema is not None else agent.memory_schema,
    )
    await db.flush()
    return agent


@router.post("/saved-agents/{agent_id}/run", response_model=RunResponse)
async def run_agent(
    agent_id: str,
    body: RunRequest,
    db: AsyncSession = Depends(get_db),
    session_factory=Depends(get_session_factory),
    provider_registry=Depends(get_provider_registry),
    agent_registry=Depends(get_agent_registry),
    tool_registry=Depends(get_tool_registry),
    index_manager=Depends(get_index_manager),
    stream_manager=Depends(get_stream_manager),
):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")

    errs = validate_inputs(agent.form_schema, body.inputs)
    if errs:
        raise HTTPException(422, detail="Invalid inputs: " + "; ".join(errs))

    session_id, stream_id = await launch_run(
        saved_agent=agent, inputs=body.inputs, model=body.model,
        session_factory=session_factory, provider_registry=provider_registry,
        agent_registry=agent_registry, tool_registry=tool_registry,
        stream_manager=stream_manager, index_manager=index_manager,
    )
    return RunResponse(session_id=session_id, stream_id=stream_id)


@router.delete("/saved-agents/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    import shutil
    from pathlib import Path
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    base = (Path(agent.workspace_path) / ".openyak" / "saved-agents").resolve()
    bundle = (base / agent.identifier).resolve()
    await db.delete(agent)
    if base in bundle.parents:
        shutil.rmtree(bundle, ignore_errors=True)
    return {"status": "deleted"}
