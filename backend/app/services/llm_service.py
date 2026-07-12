import json
import logging
from openai import AsyncAzureOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

client = AsyncAzureOpenAI(
    api_key=settings.AZURE_OPENAI_API_KEY,
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_version=settings.AZURE_OPENAI_API_VERSION,
)


async def call_llm(system_prompt: str, context: dict) -> str | None:
    try:
        resp = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(context, default=str)},
            ],
            max_tokens=800,
            temperature=0.3,
        )
        return resp.choices[0].message.content
    except Exception:
        logger.exception("LLM call failed")
        return None
