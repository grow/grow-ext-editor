"""Editor extension for editing content in Grow."""

import os
from grow import extensions
from grow.extensions import hooks


class EditorPodspecStaticDirHook(hooks.PodspecStaticDirHook):
    """Handle the router add hook."""

    def trigger(self, previous_result, *_args, **_kwargs):
        """Execute pre deploy validation."""
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
        return [EditorPodspecStaticDirHook]
