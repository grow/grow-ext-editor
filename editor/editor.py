"""Editor extension for editing content in Grow."""

import os
from grow import extensions
from grow.extensions import hooks
from grow.routing import router as grow_router
from . import editor_api
from . import handlers


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


class EditorPodspecStaticDirHook(hooks.PodspecStaticDirHook):
    """Handle the router add hook."""

    def trigger(self, previous_result, *_args, **_kwargs):
        """Execute static dir validation."""
        previous_result = previous_result or []

        if not self.extension.config.get('enabled', True):
            return previous_result

        serve_at = '/_grow/ext/editor/'
        static_dist_dir = os.path.dirname(__file__)[len(self.pod.root):]
        static_dist_dir = '{}/'.format(os.path.join(static_dist_dir, 'dist'))

        # Add the config for a static directory for the extension assets.
        previous_result.append({
            'static_dir': static_dist_dir,
            'serve_at': serve_at,
            'fingerprinted': True,
        })

        return previous_result


class EditorExtension(extensions.BaseExtension):
    """Editor extension."""

    @property
    def available_hooks(self):
        """Returns the available hook classes."""
        return [EditorDevHandlerHook, EditorPodspecStaticDirHook]
