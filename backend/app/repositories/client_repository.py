from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ClientModel


class ClientRepository:
    """Repository handling MySQL persistence for client organizations."""

    @staticmethod
    def get_by_id(db: Session, client_id: str) -> ClientModel | None:
        """Fetch client by primary key UUID."""
        stmt = select(ClientModel).where(ClientModel.id == client_id)
        return db.scalars(stmt).first()

    @staticmethod
    def get_by_normalized_name(db: Session, name: str) -> ClientModel | None:
        """Case-insensitive lookup to avoid accidental duplicate client records."""
        cleaned = name.strip()
        stmt = select(ClientModel).where(func.lower(ClientModel.name) == cleaned.lower())
        return db.scalars(stmt).first()

    @staticmethod
    def create(db: Session, name: str) -> ClientModel:
        """Create and commit a new client record in MySQL."""
        client = ClientModel(name=name.strip())
        db.add(client)
        db.commit()
        db.refresh(client)
        return client

    @staticmethod
    def list_all(db: Session, skip: int = 0, limit: int = 100) -> tuple[list[ClientModel], int]:
        """Retrieve paginated clients ordered alphabetically with total count."""
        count_stmt = select(func.count(ClientModel.id))
        total = db.scalar(count_stmt) or 0

        list_stmt = select(ClientModel).order_by(ClientModel.name.asc()).offset(skip).limit(limit)
        items = list(db.scalars(list_stmt).all())
        return items, total

    @staticmethod
    def delete(db: Session, client_id: str) -> bool:
        """Delete client by ID."""
        client = ClientRepository.get_by_id(db, client_id)
        if not client:
            return False
        db.delete(client)
        db.commit()
        return True
