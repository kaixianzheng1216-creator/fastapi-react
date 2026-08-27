from pathlib import Path
from shutil import copyfileobj
from urllib.request import urlopen

MODEL_REVISION = "e44369c5623cc146f016da906583db4ee0e3488d"

MODEL_BASE_URL = (
    "https://modelscope.cn/models/BAAI/bge-m3/resolve/"
    f"{MODEL_REVISION}"
)

TOKENIZER_FILES = (
    "config.json",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
)

TOKENIZER_DIRECTORY = Path("/app/models/bge-m3-tokenizer")


def main() -> None:
    TOKENIZER_DIRECTORY.mkdir(parents=True, exist_ok=True)

    for filename in TOKENIZER_FILES:
        destination = TOKENIZER_DIRECTORY / filename

        with urlopen(  # noqa: S310
            f"{MODEL_BASE_URL}/{filename}",
            timeout=120,
        ) as response:
            with destination.open("wb") as output:
                copyfileobj(response, output)


if __name__ == "__main__":
    main()
