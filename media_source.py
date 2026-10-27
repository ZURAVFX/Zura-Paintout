from urllib.parse import urlsplit

def require_same_origin(request):
    """Match Studio's browser-origin boundary; CLI without Origin is allowed."""
    from aiohttp import web
    origin = request.headers.get('Origin')
    if origin:
        parsed = urlsplit(origin)
        if parsed.scheme not in ('http', 'https') or parsed.netloc != request.host or parsed.username or parsed.password:
            raise web.HTTPForbidden(text='Open the video picker inside this ComfyUI instance.')
    elif request.headers.get('Sec-Fetch-Site') == 'cross-site':
        raise web.HTTPForbidden(text='Open the video picker inside this ComfyUI instance.')
