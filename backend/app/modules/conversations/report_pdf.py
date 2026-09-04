import asyncio
import json
import logging
import uuid
from urllib.parse import urlsplit

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import Route, async_playwright

from app.core.config import settings
from app.modules.conversations.exceptions import ConversationReportPdfGenerationError
from app.modules.files import object_storage

REPORT_PRINT_TIMEOUT_MS = 60_000
REPORT_PRINT_STATUS_EXPRESSION = """
() => ["ready", "error"].includes(
  document.documentElement.dataset.reportPrintStatus
)
"""
logger = logging.getLogger(__name__)


async def generate_and_store_report_pdf(
    *,
    owner_id: uuid.UUID,
    conversation_id: uuid.UUID,
    report: str,
) -> None:
    """生成并保存 PDF，返回时文件已经可以下载。"""
    # 准备打印页面地址和待注入的报告数据。
    frontend_url = str(settings.FRONTEND_URL).rstrip("/")
    parsed_frontend_url = urlsplit(frontend_url)
    frontend_origin = f"{parsed_frontend_url.scheme}://{parsed_frontend_url.netloc}"

    init_script = f"""
if (location.origin === {json.dumps(frontend_origin)}) {{
  window.__REPORT__ = {json.dumps(report)};
}}
"""

    # 只允许浏览器加载打印页自身资源和内嵌资源。
    async def allow_internal_requests(route: Route) -> None:
        request_url = urlsplit(route.request.url)
        request_origin = f"{request_url.scheme}://{request_url.netloc}"

        if request_origin == frontend_origin or request_url.scheme in {"blob", "data"}:
            await route.continue_()
        else:
            await route.abort()

    # 启动 Chromium 并打开内部打印页面。
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                executable_path=settings.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
            )

            try:
                context = await browser.new_context(locale="zh-CN")

                try:
                    await context.route("**/*", allow_internal_requests)

                    await context.add_init_script(script=init_script)

                    page = await context.new_page()

                    response = await page.goto(
                        f"{frontend_url}/reports/print",
                        wait_until="domcontentloaded",
                        timeout=REPORT_PRINT_TIMEOUT_MS,
                    )

                    if response is None or not response.ok:
                        raise ConversationReportPdfGenerationError

                    # 等待字体、图片和图表渲染完成后生成 PDF。
                    await page.wait_for_function(
                        REPORT_PRINT_STATUS_EXPRESSION,
                        timeout=REPORT_PRINT_TIMEOUT_MS,
                    )

                    status = await page.evaluate(
                        "document.documentElement.dataset.reportPrintStatus"
                    )

                    if status == "error":
                        raise ConversationReportPdfGenerationError

                    content = await page.pdf(
                        print_background=True,
                        prefer_css_page_size=True,
                        tagged=True,
                    )
                finally:
                    await context.close()
            finally:
                await browser.close()
    except OSError, PlaywrightError:
        logger.exception(
            "生成会话报告 PDF 失败",
            extra={"conversation_id": str(conversation_id)},
        )

        raise ConversationReportPdfGenerationError from None

    # 浏览器关闭后，将生成结果写入对象存储。
    await asyncio.to_thread(
        object_storage.write_object_content,
        object_key=report_pdf_object_key(owner_id, conversation_id),
        content=content,
        content_type="application/pdf",
    )


async def read_report_pdf(
    *,
    owner_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> bytes:
    return await asyncio.to_thread(
        object_storage.read_object_bytes,
        object_key=report_pdf_object_key(owner_id, conversation_id),
    )


def report_pdf_object_key(
    owner_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> str:
    return f"reports/{owner_id}/{conversation_id.hex}.pdf"
