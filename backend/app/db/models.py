# ruff: noqa: I001

from sqlmodel import SQLModel

from app.modules.users.models import User  # noqa: F401
from app.modules.files.models import StoredFile  # noqa: F401
from app.modules.conversations.models import (  # noqa: F401
    Conversation,
    ConversationFile,
)
from app.modules.knowledge.models import (  # noqa: F401
    KnowledgeBase,
    KnowledgeDocument,
    KnowledgeFolder,
)
from app.modules.brand_marketing.models import (  # noqa: F401
    ProvinceAnnualIndicator,
)
from app.modules.content_operations.models import (  # noqa: F401
    BilibiliRankingItem,
    BilibiliRankingSnapshot,
)
from app.modules.influencer_marketing.models import (  # noqa: F401
    InfluencerAccount,
    InfluencerAccountSnapshot,
)

metadata = SQLModel.metadata
