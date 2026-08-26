from dataclasses import dataclass
from enum import StrEnum


class BilibiliRankingCategoryCode(StrEnum):
    ALL = "all"
    ANIMATION = "animation"
    GAME = "game"
    KICHIKU = "kichiku"
    MUSIC = "music"
    DANCE = "dance"
    CINEPHILE = "cinephile"
    ENTERTAINMENT = "entertainment"
    KNOWLEDGE = "knowledge"
    TECH = "tech"
    FOOD = "food"
    CAR = "car"
    FASHION = "fashion"
    SPORTS = "sports"


@dataclass(frozen=True, slots=True)
class BilibiliRankingCategory:
    code: BilibiliRankingCategoryCode
    name: str
    rid: int


BILIBILI_RANKING_CATEGORIES = (
    BilibiliRankingCategory(BilibiliRankingCategoryCode.ALL, "全部", 0),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.ANIMATION, "动画", 1005),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.GAME, "游戏", 1008),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.KICHIKU, "鬼畜", 1007),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.MUSIC, "音乐", 1003),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.DANCE, "舞蹈", 1004),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.CINEPHILE, "影视", 1001),
    BilibiliRankingCategory(
        BilibiliRankingCategoryCode.ENTERTAINMENT,
        "娱乐",
        1002,
    ),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.KNOWLEDGE, "知识", 1010),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.TECH, "科技数码", 1012),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.FOOD, "美食", 1020),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.CAR, "汽车", 1013),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.FASHION, "时尚美妆", 1014),
    BilibiliRankingCategory(BilibiliRankingCategoryCode.SPORTS, "体育运动", 1018),
)
