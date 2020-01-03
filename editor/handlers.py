"""Handlers for working with content editor."""

import os
import jinja2
from werkzeug import wrappers
from grow import storage
from grow.common import utils
from grow.templates import filters


@utils.memoize
def create_jinja_env():
    root = os.path.join(os.path.dirname(__file__), 'views')
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
    }
    env = create_jinja_env()
    template = env.get_template('/base.html')
    content = template.render(kwargs)
    response = wrappers.Response(content)
    response.headers['Content-Type'] = 'text/html'
    return response
