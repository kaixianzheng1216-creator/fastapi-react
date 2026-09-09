from fastapi.routing import APIRoute


def custom_generate_unique_id(route: APIRoute) -> str:
    tag = route.tags[0] if route.tags else route.name

    return f"{tag}-{route.name}"
