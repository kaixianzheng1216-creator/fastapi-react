from enum import StrEnum


class InfluencerPlatformCode(StrEnum):
    DOUYIN = "douyin"
    XIAOHONGSHU = "xiaohongshu"


PLATFORM_SOURCE_CODES = {
    "抖音": InfluencerPlatformCode.DOUYIN,
    "小红书": InfluencerPlatformCode.XIAOHONGSHU,
}
