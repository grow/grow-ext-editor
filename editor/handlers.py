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


# TODO: Centralize the partial config loading.
def get_partials(pod):
    """Handle the request for editor content."""
    partials = {}

    # View partials.
    view_pod_paths = []
    split_front_matter = document_front_matter.DocumentFrontMatter.split_front_matter
    for root, dirs, files in pod.walk('/views/partials/'):
        pod_dir = root.replace(pod.root, '')
        for file_name in files:
            view_pod_paths.append(os.path.join(pod_dir, file_name))

    for view_pod_path in view_pod_paths:
        partial_key, _ = os.path.splitext(os.path.basename(view_pod_path))
        front_matter, _ = split_front_matter(pod.read_file(view_pod_path))
        if front_matter:
            editor_config = utils.parse_yaml(
                front_matter, pod=pod, locale=None) or {}
            partials[partial_key] = editor_config.get('editor', {})

    return partials


class RenderPartialController(render_controller.RenderDocumentController):
    """Controller for handling rendering for partial previews."""

    def __repr__(self):
        return '<RenderPartialController({})>'.format(self.params['partial'])

    @property
    def doc(self):
        """Doc for the controller."""
        if not self._doc:
            partial = self.params['partial']
            ext_config = structures.DeepReferenceDict(
                self.pod.extensions_controller.extension_config(
                    'extensions.editor.EditorExtension'))

            collection_path = ext_config['screenshots.partials.collection']

            if not collection_path:
                raise werkzeug_exceptions.BadRequest(
                    'No collection path defined for partial screenshots')

            col = self.pod.get_collection(collection_path)

            partials = get_partials(self.pod)
            partial_config = partials.get(partial)
            partial_example = partial_config.get(
                'examples', {}).get(self.params['key'])
            if not partial_example:
                raise werkzeug_exceptions.NotFound(
                    'Unable to find example in partial: {}'.format(self.params['key']))

            partial_example['partial'] = partial

            doc_fields = {
                '$view': ext_config['screenshots.partials.view'],
                'partials': [
                    partial_example,
                ],
            }

            locale = self.route_info.meta.get(
                'locale', self.params.get('locale'))
            pod_path = os.path.join(collection_path, '_partial.yaml')
            self._doc = document.Document(
                pod_path, locale=locale, _pod=self.pod, _collection=col)
            self._doc.format.update(fields=doc_fields)
        return self._doc


class RenderTemplateController(render_controller.RenderDocumentController):
    """Controller for handling rendering for documents."""

    def __repr__(self):
        return '<RenderTemplateController({})>'.format(self.params['collection'])

    @property
    def doc(self):
        """Doc for the controller."""
        if not self._doc:
            collection_path = '/{}'.format(self.params['collection'])
            collection_path_parts = collection_path.split('/')
            key = collection_path_parts.pop()
            collection_path = '/'.join(collection_path_parts)
            col = self.pod.get_collection(collection_path)

            # Find the template file to load the template from.
            template_path = os.path.join(collection_path, TEMPLATE_FILE_NAME)

            try:
                template_info = self.pod.read_yaml(template_path)
            except IOError:
                raise werkzeug_exceptions.NotFound(
                    'No template file found for collection: {}'.format(template_path))

            template_meta = template_info.get(key)

            if not template_meta:
                raise werkzeug_exceptions.NotFound(
                    'Unable to find template: {}'.format(key))

            locale = self.route_info.meta.get(
                'locale', self.params.get('locale'))
            pod_path = os.path.join(collection_path, '_template.{}'.format(
                template_meta.get('file_extension', 'html')))
            self._doc = document.Document(
                pod_path, locale=locale, _pod=self.pod, _collection=col)
            self._doc.format.update(
                fields=template_meta.get('front_matter'), content=template_meta.get('content'))
        return self._doc


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


def serve_partial(pod, request, matched, meta=None, **_kwargs):
    """Serve pod contents using the template."""
    controller = RenderPartialController(
        pod, request.path, matched.value, params=matched.params)
    response = None
    headers = controller.get_http_headers()
    if 'X-AppEngine-BlobKey' in headers:
        return Response(headers=headers)
    jinja_env = pod.render_pool.get_jinja_env(
        controller.doc.locale) if controller.use_jinja else None
    rendered_document = controller.render(jinja_env=jinja_env, request=request)
    content = rendered_document.read()
    response = wrappers.Response(content)
    # TODO: headers.update is not found...?
    response.headers.extend(headers)
    return response


def serve_template(pod, request, matched, meta=None, **_kwargs):
    """Serve pod contents using the template."""
    controller = RenderTemplateController(
        pod, request.path, matched.value, params=matched.params)
    response = None
    headers = controller.get_http_headers()
    if 'X-AppEngine-BlobKey' in headers:
        return Response(headers=headers)
    jinja_env = pod.render_pool.get_jinja_env(
        controller.doc.locale) if controller.use_jinja else None
    rendered_document = controller.render(jinja_env=jinja_env, request=request)
    content = rendered_document.read()
    response = wrappers.Response(content)
    # TODO: headers.update is not found...?
    response.headers.extend(headers)
    return response
