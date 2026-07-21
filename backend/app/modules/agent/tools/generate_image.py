from langchain_core.tools import tool
from openai import AsyncOpenAI

from app.modules.agent.config import settings


@tool
async def generate_image(prompt: str) -> str:
    """根据文字描述生成一张图片，返回图片 URL 或 data URI。"""
    if not prompt.strip():
        raise ValueError("生图提示词不能为空")

    api_key = settings.IMAGE_API_KEY
    base_url = settings.IMAGE_BASE_URL
    model = settings.IMAGE_MODEL

    if api_key is None or base_url is None or model is None:
        raise RuntimeError("生图配置不完整")

    async with AsyncOpenAI(
        api_key=api_key.get_secret_value(),
        base_url=base_url,
    ) as client:
        response = await client.images.generate(
            model=model,
            prompt=prompt,
        )

    if not response.data:
        raise RuntimeError("生图接口未返回图片")

    image = response.data[0]
    if image.url:
        return image.url
    if image.b64_json:
        return f"data:image/png;base64,{image.b64_json}"

    raise RuntimeError("生图接口未返回图片")
