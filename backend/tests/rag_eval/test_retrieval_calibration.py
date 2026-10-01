"""Checks RETRIEVAL_MIN_SIMILARITY against the configured embedding model.

Run with `-s` to print the scores when choosing a threshold: it must sit below every answerable
question's best score and above every unrelated question's best score.
"""

import pytest

from app.embeddings.provider import create_embedding_provider
from app.rag.retriever import retrieve

pytestmark = pytest.mark.live

CORPUS = {
    "hr-policy.txt": "Employees receive 20 days of paid leave per year. Remote work requires "
    "written approval from a manager. Expense claims must be submitted within 30 days.",
    "company.txt": "The company was founded in 2015 in Hyderabad. Its head office is in the "
    "Hitech City district and it builds payroll software for small businesses.",
}
ANSWERABLE = [
    "How many days of paid leave do employees get?",
    "Can I work from home?",
    "When was the company founded?",
    "What does the company build?",
]
UNRELATED = [
    "What is the capital of France?",
    "How do I bake sourdough bread?",
    "Who won the football world cup in 2018?",
]


def test_threshold_separates_answerable_from_unrelated(knowledge_base, repo, settings):
    knowledge_base(CORPUS)
    embedder = create_embedding_provider(settings)

    def best(question: str) -> float:
        found = retrieve(question, repo=repo, embedder=embedder, top_k=1, min_similarity=-1)
        return found.best_similarity or -1

    answerable = {q: best(q) for q in ANSWERABLE}
    unrelated = {q: best(q) for q in UNRELATED}
    for label, scores in (("answerable", answerable), ("unrelated", unrelated)):
        for question, score in scores.items():
            print(f"{label:>10}  {score:.3f}  {question}")

    threshold = settings.retrieval_min_similarity
    assert min(answerable.values()) >= threshold, "threshold too high: answerable questions lost"
    assert max(unrelated.values()) < threshold, "threshold too low: unrelated questions pass"
