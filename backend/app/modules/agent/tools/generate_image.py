from langchain_core.tools import BaseTool, tool
from openai import AsyncOpenAI
from openai.types.images_response import ImagesResponse

from app.modules.agent.config import settings

MAX_REFERENCE_IMAGES = 16


def load_image_tools() -> list[BaseTool]:
    api_key = settings.IMAGE_API_KEY

    if api_key is None:
        return []

    base_url = settings.IMAGE_BASE_URL
    model = settings.IMAGE_MODEL

    if base_url is None or model is None:
        raise RuntimeError("生图配置不完整")

    @tool("generate_image")
    async def generate_image(
        prompt: str,
        size: str = "auto",
        image_urls: list[str] | None = None,
    ) -> str:
        """生成图片；提供 image_urls 时根据一张或多张参考图片生成。"""
        if not prompt.strip():
            raise ValueError("生图提示词不能为空")
        if image_urls and len(image_urls) > MAX_REFERENCE_IMAGES:
            raise ValueError(f"参考图片不能超过 {MAX_REFERENCE_IMAGES} 张")

        async with AsyncOpenAI(
            api_key=api_key.get_secret_value(),
            base_url=base_url,
        ) as client:
            if image_urls:
                response = await client.post(
                    "/images/edits",
                    cast_to=ImagesResponse,
                    body={
                        "model": model,
                        "prompt": prompt,
                        "size": size,
                        "images": [{"image_url": url} for url in image_urls],
                    },
                )
            else:
                response = await client.post(
                    "/images/generations",
                    cast_to=ImagesResponse,
                    body={
                        "model": model,
                        "prompt": prompt,
                        "size": size,
                    },
                )

        if not response.data:
            raise RuntimeError("生图接口未返回图片")

        image = response.data[0]

        if image.url:
            return image.url
        if image.b64_json:
            return f"data:image/png;base64,{image.b64_json}"

        raise RuntimeError("生图接口未返回图片")

    return [generate_image]
