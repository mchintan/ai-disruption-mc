from app.contexts.fulfill.providers.base import BrokerProvider
from app.contexts.fulfill.providers.alpaca import AlpacaProvider

PROVIDERS: dict[str, type[BrokerProvider]] = {
    "alpaca": AlpacaProvider,
}


def get_provider(name: str) -> BrokerProvider:
    cls = PROVIDERS.get(name)
    if not cls:
        raise ValueError(f"Unknown broker: {name}. Available: {list(PROVIDERS.keys())}")
    return cls()
