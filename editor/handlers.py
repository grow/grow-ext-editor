"""Handlers for working with content editor."""

import os
import jinja2
from werkzeug import wrappers
from werkzeug import exceptions as werkzeug_exceptions
from grow import storage
from grow.common import structures
from grow.common import utils
from grow.documents import document
from grow.documents import document_front_matter
from grow.rendering import render_controller
from grow.templates import filters


TEMPLATE_FILE_NAME = '_template.yaml'

PREVIEW_ORIGINS = [
  'https://editor.dev',
  'https://beta.editor.dev',
  'http://localhost:3000',
  'http://localhost:8080',
]


@utils.memoize
def create_jinja_env():
    root = os.path.join(os.path.dirname(__file__), 'dist')
    loader = storage.FileStorage.JinjaLoader(root)
    env = jinja2.Environment(
        loader=loader,
        autoescape=True,
        trim_blocks=True,
        extensions=[
            'jinja2.ext.autoescape',
            'jinja2.ext.do',
            'jinja2.ext.i18n',
            'jinja2.ext.loopcontrols',
            'jinja2.ext.with_',
        ])
    env.filters.update(filters.create_builtin_filters(env, None))
    return env


def serve_editor(pod, _request, matched, meta=None, **_kwargs):
    """Serve the default console page."""
    kwargs = {
        'pod': pod,
        'meta': meta,
        'path': matched.params['path'] if 'path' in matched.params else '',
        'env': {
            'is_local': 'development' if '/Users/' in os.getenv('PATH', '') else 'production',
        }
    }
    env = create_jinja_env()
    template = env.get_template('/base.html')
    content = template.render(kwargs)
    response = wrappers.Response(content)
    response.headers['Content-Type'] = 'text/html'
    return response


def serve_preview_server(pod, request, matched, meta=None, **_kwargs):
    """Serve the default console page."""

    # Get all the base pod paths and use to find all localized docs.
    temp_router = pod.router.__class__(pod)
    temp_router.add_all()
    routes = {}
    pod_paths = set()

    for path, route, _ in temp_router.routes.nodes:
        if route.kind == 'doc' and 'pod_path' in route.meta:
            pod_paths.add(route.meta['pod_path'])
        elif route.kind == 'static':
            routes[route.meta['pod_path']] = {
                'path': path,
            }

    for pod_path in pod_paths:
        doc = pod.get_doc(pod_path)
        routes[doc.pod_path] = {}

        for locale in doc.locales:
            routes[doc.pod_path] = {
                "path": doc.localize(locale).get_serving_path(),
            }

    kwargs = {
        'pod': pod,
        'meta': meta,
        'routes': routes,
        'path': matched.params['path'] if 'path' in matched.params else '',
        'env': {
            'is_local': 'development' if '/Users/' in os.getenv('PATH', '') else 'production',
        }
    }

    origin = request.headers.get('Origin') or PREVIEW_ORIGINS[0]
    origin = origin if origin in PREVIEW_ORIGINS else PREVIEW_ORIGINS[0]

    env = create_jinja_env()
    template = env.get_template('/preview.json')
    content = template.render(kwargs)
    response = wrappers.Response(content)
    response.headers['Content-Type'] = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response
