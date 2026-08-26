from sqlmodel import SQLModel

from app.modules.brand_marketing.models import (  # noqa: F401
    ProvinceAnnualIndicator,
)
from app.modules.conversations.models import (  # noqa: F401
    Conversation,
    ConversationFile,
)
from app.modules.files.models import StoredFile  # noqa: F401
from app.modules.items.models import Item  # noqa: F401
from app.modules.knowledge.models import (  # noqa: F401
    KnowledgeBase,
    KnowledgeDocument,
)
from app.modules.users.models import User  # noqa: F401

metadata = SQLModel.metadata
