"""Chat: one question in, Server-Sent Events out.

Events: `stage` (retrieving → generating → verifying) while working, then one `result`
(or one `error`). The answer is only sent once it has passed every guardrail, so no unverified
text ever reaches the browser.
"""

import json
import logging
from collections.abc import Iterator

import psycopg
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.errors import AppError
from app.rag.service import answer_question

router = APIRouter(prefix="/api", tags=["chat"])
log = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@router.post("/chat")
def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    question = body.question.strip()
    if not question:
        raise AppError("INVALID_REQUEST", "Please enter a question.")
    state = request.app.state

    def events() -> Iterator[str]:
        try:
            for event in answer_question(
                question,
                repo=state.repo,
                embedder=state.embedder,
                llm=state.llm,
                settings=state.settings,
            ):
                yield _sse(event)
        except AppError as exc:
            yield _sse({"event": "error", "code": exc.code, "message": exc.message})
        except psycopg.OperationalError:
            log.exception("database unavailable during chat")
            message = "The database is unavailable. Please try again shortly."
            yield _sse({"event": "error", "code": "DATABASE_UNAVAILABLE", "message": message})
        except Exception:
            log.exception("chat failed")
            message = "Something went wrong on our side. Please try again."
            yield _sse({"event": "error", "code": "INTERNAL_ERROR", "message": message})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(event: dict) -> str:
    payload = {key: value for key, value in event.items() if key != "event"}
    return f"event: {event['event']}\ndata: {json.dumps(payload)}\n\n"
