from fastapi import APIRouter

from backend.models import CategoryOut
from backend.routes.deps import CategoryRepositoryDep

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(categories: CategoryRepositoryDep) -> list[CategoryOut]:
    return [CategoryOut.model_validate(category) for category in categories.list_active()]
