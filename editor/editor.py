"""Editor extension for editing content in Grow."""

from grow import extensions
from grow.common import colors
from grow.extensions import hooks
from grow.routing import router as grow_router
from . import editor_api
from . import handlers


try:
    DevManagerMessageHook = hooks.DevManagerMessageHook
except:
    # TODO: Remove try when grow 0.8.25 is common.
    try:
        DevManagerMessageHook = hooks.StubHook
    except:
        from grow.extensions.hooks import base_hook
        DevManagerMessageHook = base_hook.BaseHook


class EditorDevHandlerHook(hooks.DevHandlerHook):
    """Handle the dev handler hook."""

    # pylint: disable=arguments-differ
    def trigger(self, previous_result, routes, host='localhost', port=8080, *_args, **_kwargs):
        """Execute dev handler modification."""
        routes.add('/_grow/api/editor/*path', grow_router.RouteInfo('console', meta={
            'handler': editor_api.serve_api,
        }))

        editor_meta = {
            'handler': handlers.serve_editor,
            'meta': {
                'app': {
                    'host': host,
                    'port': port,
                },
            },
        }
        routes.add(
            '/_grow/editor/*path',
            grow_router.RouteInfo('console', meta=editor_meta))
        routes.add(
            '/_grow/editor',
            grow_router.RouteInfo('console', meta=editor_meta))

        partial_meta = {
            'handler': handlers.serve_partial,
            'meta': {
                'app': {
                    'host': host,
                    'port': port,
                },
            },
        }

        routes.add(
            '/_grow/screenshot/partial/:partial/:key/',
            grow_router.RouteInfo('console', meta=partial_meta))

        template_meta = {
            'handler': handlers.serve_template,
            'meta': {
                'app': {
                    'host': host,
                    'port': port,
                },
            },
        }
        routes.add(
            '/_grow/screenshot/template/*collection',
            grow_router.RouteInfo('console', meta=template_meta))


class EditorDevManagerMessageHook(DevManagerMessageHook):
    """Handle the router add hook."""

    def trigger(self, previous_result, display_func, url_base, url_root, *_args, **_kwargs):
        """Execute static dir validation."""
        url_editor = '{}_grow/editor'.format(url_base)
        display_func('Editor:', url_editor, colors.HIGHLIGHT)

        # Append the url so that it can be opened with using the `-b` flag.
        previous_result = previous_result or []
        previous_result.append(url_editor)
        return previous_result

class EditorPodspecStaticDirHook(hooks.PodspecStaticDirHook):
    """Handle the router add hook."""

    def trigger(self, previous_result, *_args, **_kwargs):
        """Execute static dir validation."""
        previous_result = previous_result or []

        if not self.extension.config.get('enabled', True):
            return previous_result

        # Add the config for a static directory for the extension assets.
        previous_result.append({
            'static_dir': '/extensions/editor/dist/',
            'serve_at': '/_grow/ext/editor/',
            'fingerprinted': True,
        })

        return previous_result


class EditorExtension(extensions.BaseExtension):
    """Editor extension."""

    @property
    def available_hooks(self):
        """Returns the available hook classes."""
        return [
            EditorDevHandlerHook,
            EditorPodspecStaticDirHook,
            EditorDevManagerMessageHook,
        ]
