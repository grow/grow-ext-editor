"""API Handler for serving api requests."""

from __future__ import print_function
import datetime
import hashlib
import json
import os
import re
import subprocess
import yaml
from werkzeug import wrappers
from werkzeug.exceptions import BadRequest, NotFound
from selenium.common import exceptions as selenium_exceptions
from grow.common import json_encoder
from grow.common import utils
from grow.common import yaml_utils
from grow.documents import document
from grow.documents import document_front_matter
from grow.routing import router as grow_router
from .api import screenshot
from .api import yaml_conversion


class PodApi(object):
    """Basic pod api."""

    EDITOR_FILE_NAME = '_editor.yaml'
    TEMPLATE_FILE_NAME = '_template.yaml'
    STRINGS_PATH = '/content/strings'
    IGNORED_BRANCHES = (
        'HEAD',
    )
    IGNORED_PREFIXES = (
        '.',
        '_',
    )
    IGNORED_EXTS = (
        '.pyc',
    )
    IGNORED_DIRS = (
        '/backend/',
        '/build/',
        '/ext/',
        '/extensions/',
        '/node_modules/',
    )
    MIME_TO_TYPE = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }

    def __init__(self, pod, request, matched):
        self.pod = pod
        self.request = request
        self.matched = matched
        self.data = {}
        try:
            self.ext_config = self.pod.extensions_controller.extension_config(
                'extensions.editor.EditorExtension')
        except AttributeError:
            # TODO: Remove when Grow > 0.8.20
            self.ext_config = {}
        self.handle_request()

    @property
    def response(self):
        """Generate a response object from the request information."""
        data = json.dumps(self.data, cls=json_encoder.GrowJSONEncoder)
        return wrappers.Response(data, mimetype='application/json')

    def _editor_config(self, doc):
        """Return the editor configuration for the document."""
        # See if the document has an editor config.
        fields = doc.format.front_matter.data
        config = fields.get('$editor')
        if config:
            return config

        # Fall back to the collection level editor config.
        collection = doc.collection
        editor_path = os.path.join(collection.pod_path, self.EDITOR_FILE_NAME)
        if not self.pod.file_exists(editor_path):
            return {}
        return self.pod.read_yaml(editor_path) or {}

    def _editor_config_partial(self, partial):
        """Return the editor configuration for the partial."""
        editor_path = '{}/{}'.format(partial.pod_path, self.EDITOR_FILE_NAME)
        if self.pod.file_exists(editor_path):
            return self.pod.read_yaml(editor_path) or {}
        return {}

    def _format_screenshot_base(self, path, key):
        """Format the screenshot base name."""
        if not path.endswith('/'):
            path = '{}/'.format(path)
        return '{path}{key}'.format(
            path=path,
            key=key).strip('/')

    def _get_param(self, param_name):
        """Support getting params from different request types."""
        try:
            return self.request.params.get(param_name)
        except AttributeError:
            # Support flask requests.
            return self.request.args.get(param_name)

    def _get_post(self, param_name):
        """Support getting form data from different request types."""
        try:
            return self.request.POST.get(param_name)
        except AttributeError:
            # Support flask requests.
            return self.request.form.get(param_name)

    def _get_resolutions(self):
        """Pull the resolutions from config."""
        screenshot_config = self.ext_config.get('screenshots', {})
        resolutions_raw = screenshot_config.get('resolutions', [{
            'width': 1280,
            'height': 1600,
        }])
        resolutions = []
        for resolution_raw in resolutions_raw:
            resolutions.append(screenshot.ScreenshotResolution(
                resolution_raw['width'], resolution_raw['height']))
        return resolutions

    def _get_screenshot_dir(self):
        """Pull the screenshot dir from config."""
        screenshot_config = self.ext_config.get('screenshots', {})
        return screenshot_config.get('static_dir', screenshot.DEFAULT_SCREENSHOT_DIR)

    def _get_collection_templates(self, collection):
        """Find any collection templates for a collection."""
        template_pod_path = os.path.join(
            collection.pod_path, self.TEMPLATE_FILE_NAME)
        if self.pod.file_exists(template_pod_path):
            return self.pod.read_yaml(template_pod_path)
        return {}

    def _has_post(self, param_name):
        """Support detecting form data from different request types."""
        try:
            return param_name in self.request.POST
        except AttributeError:
            # Support flask requests.
            return param_name in self.request.form

    def _is_ignored_dir(self, full_path):
        ignored_dirs = self.ext_config.get('ignored_dirs', tuple())
        if full_path.startswith(self.IGNORED_DIRS + ignored_dirs):
            return True
        return False

    def _is_ignored_name(self, file_name):
        ignored_prefixes = self.ext_config.get('ignored_prefixes', tuple())
        ignored_exts = self.ext_config.get('ignored_exts', tuple())
        if file_name.startswith(self.IGNORED_PREFIXES + ignored_prefixes):
            return True
        if file_name.endswith(self.IGNORED_EXTS + ignored_exts):
            return True
        return False

    def _load_doc(self, pod_path):
        doc = self.pod.get_doc(pod_path)

        if not doc.exists:
            return {
                'pod_path': doc.pod_path,
                'editor': self._editor_config(doc),
                'front_matter': {},
                'serving_paths': {},
                'default_locale': str(doc.default_locale),
                'locales': [str(locale) for locale in doc.locales],
                'raw_front_matter': '',
                'content': '',
                'hash': None,
            }

        serving_paths = {}
        try:
            serving_path = doc.get_serving_path()
            serving_paths[str(doc.default_locale)] = serving_path
            for key, value in doc.get_serving_paths_localized().items():
                serving_paths[str(key)] = value
        except document.PathFormatError:
            # Document is just a partial content file, or has no serving path,
            # or has an error with its serving path.
            serving_path = None

        raw_front_matter = doc.format.front_matter.export()

        # No front matter, just plain HTML or Markdown.
        if raw_front_matter:
            front_matter = yaml.load(
                raw_front_matter, Loader=yaml_utils.PlainTextYamlLoader)
        else:
            front_matter = {}

        return {
            'pod_path': doc.pod_path,
            'editor': self._editor_config(doc),
            'front_matter': front_matter,
            'serving_paths': serving_paths,
            'default_locale': str(doc.default_locale),
            'locales': [str(locale) for locale in doc.locales],
            'raw_front_matter': raw_front_matter,
            'content': doc.body,
            'hash': self.pod.hash_file(pod_path),
        }

    def _load_static_doc(self, pod_path):
        static_doc = self.pod.get_static(pod_path)
        return {
            'pod_path': static_doc.pod_path,
            'serving_url': static_doc.url.path,
        }

    @staticmethod
    def force_string(value):
        try:
            return value.decode('utf-8')
        except (UnicodeDecodeError, AttributeError):
            return value

    def content_from_template(self):
        """Handle the request for copying files."""
        collection_path = self._get_param('collection_path')
        key = self._get_param('key')
        file_name = self._get_param('file_name').strip()
        collection = self.pod.get_collection(collection_path)
        templates = self._get_collection_templates(collection)

        template_meta = templates.get(key)

        # Allow collection to define a default page template.
        if not template_meta:
            template_meta = templates.get('_default')

        # No template selected, making an arbitrary blank page.
        if not template_meta:
            # Write a blank file.
            pod_path = os.path.join(collection.pod_path, file_name)
            self.pod.write_file(pod_path, '')
            return

        # Add the extension if not provided.
        file_ext = template_meta.get('extension')
        if file_ext and not file_name.endswith(file_ext):
            file_name = '{}.{}'.format(file_name, file_ext)

        pod_path = os.path.join(collection.pod_path, file_name)
        doc = document.Document(
            pod_path, _pod=self.pod, _collection=collection)
        doc.format.update(
            fields=template_meta.get('front_matter'), content=template_meta.get('content'))
        doc.write()

    def copy_pod_path(self):
        """Handle the request for copying files."""
        pod_path = self._get_param('pod_path')
        new_pod_path = self._get_param('new_pod_path')
        if not self.pod.file_exists(pod_path):
            raise BadRequest('{} does not exist in the pod'.format(pod_path))
        if self.pod.file_exists(new_pod_path):
            raise BadRequest(
                '{} would overwrite an existing file in the pod'.format(new_pod_path))
        self.pod.write_file(new_pod_path, self.pod.read_file(pod_path))

    def delete_pod_path(self):
        """Handle the request for deleting files."""
        pod_path = self._get_param('pod_path')
        if not self.pod.file_exists(pod_path):
            raise BadRequest('{} does not exist in the pod'.format(pod_path))
        self.pod.delete_file(pod_path)

    def get_pod_paths(self):
        """Handle the request for document and static info."""
        pod_paths = []

        for root, dirs, files in self.pod.walk('/'):
            for directory in dirs:
                if directory.startswith('.'):
                    dirs.remove(directory)
            pod_dir = root.replace(self.pod.root, '')
            for file_name in files:
                if self._is_ignored_name(file_name):
                    continue
                full_path = os.path.join(pod_dir, file_name)
                if self._is_ignored_dir(full_path):
                    continue
                pod_paths.append(full_path)

        self.data = {
            'pod_paths': pod_paths,
        }

    def get_editor_content(self):
        """Handle the request for editor content."""
        pod_path = self._get_param('pod_path')
        self.data = self._load_doc(pod_path)

    def get_extension_config(self):
        """Handle the request for editor content."""
        extension_path = self._get_param('extension_path')

        try:
            ext_config = self.pod.extensions_controller.extension_config(
                extension_path)
        except AttributeError:
            # TODO: Remove when Grow > 0.8.20
            ext_config = {}

        self.data = ext_config

    def get_partials(self):
        """Handle the request for editor content."""
        partials = {}

        # Stand alone partials.
        for partial in self.pod.partials.get_partials():
            partials[partial.key] = partial.config.get(
                'editor', {})

            screenshots = {}

            # Find any existing screenshots.
            screenshot_pod_dir = self._get_screenshot_dir()
            examples = partials[partial.key].get('examples', [])
            for example in examples:
                screenshots[example] = {}
                screenshot_file_base = self._format_screenshot_base(partial.key, example)
                resolutions = self._get_resolutions()

                for resolution in resolutions:
                    screenshot_pod_path = os.path.join(
                        screenshot_pod_dir, 'partials', resolution.filename(screenshot_file_base))
                    if self.pod.file_exists(screenshot_pod_path):
                        screenshots[example][resolution.resolution] = self._load_static_doc(screenshot_pod_path)

            partials[partial.key]['screenshots'] = screenshots

        self.data = {
            'partials': partials,
        }

    def get_pod(self):
        """Handle the request for pod information."""
        self.data = {
            'pod': {
                'title': self.pod.podspec.title,
            },
        }

    def get_routes(self):
        """Handle the request for routing and meta info."""
        routes = {}

        # Read all of the routes in the routes.
        # TODO: Has to create a concrete routes each time. Not efficient.
        router = grow_router.Router(self.pod)
        router.use_simple()
        router.add_all(concrete=True)
        for path, node_info, _options in router.routes.nodes:
            if node_info.kind in ('doc', 'static'):
                routes[path] = {
                    'pod_path': node_info.meta['pod_path'],
                    'locale': node_info.meta.get('locale'),
                }

        self.data = {
            'routes': routes,
        }

    def get_static_serving_path(self):
        """Handle the request for pod path to serving path."""
        pod_path = self._get_param('pod_path')
        static_doc = self.pod.get_static(pod_path)

        self.data = {
            'pod_path': pod_path,
            'serving_url': static_doc.url.path,
        }

    def get_strings(self):
        """Handle the request for strings content for use with !g.string constructor."""
        strings = {
        }

        # Read all of the strings.
        pod_paths = []
        for root, dirs, files in self.pod.walk(self.STRINGS_PATH):
            pod_dir = root.replace(self.pod.root, '')
            for file_name in files:
                if not file_name.startswith(self.IGNORED_PREFIXES):
                    pod_paths.append(os.path.join(pod_dir, file_name))

        for pod_path in pod_paths:
            strings[pod_path] = self.pod.read_yaml(pod_path)

        self.data = {
            'strings': strings,
        }

    def get_repo(self):
        remote_name = self._get_param('remote') or 'origin'
        repo = utils.get_git_repo(self.pod.root)
        if not repo:
            return {}
        branch = str(repo.active_branch)
        revision = repo.git.rev_list('--count', 'HEAD')
        remote_url = None
        web_url = None
        remote = None
        for repo_remote in repo.remotes:
            if repo_remote.name == remote_name:
                remote = repo_remote
                break

        if remote:
            urls = list(remote.urls)
            remote_url = urls and urls[0]
            web_url = remote_url

            # Github
            web_url = web_url.replace('git@github.com:', 'https://www.github.com/')
            if web_url and web_url.endswith('.git'):
                web_url = web_url[:-4]

            # Google Cloud Source
            web_url = web_url.replace(
                'https://source.developers.google.com/p/', 'https://source.cloud.google.com/')
            web_url = web_url.replace('/r/', '/')

        if not remote:
            remote = repo.remote()

        # Remove the remote name from branch name (ex: origin/master => master)
        branch_names = ['/'.join(ref.name.split('/')[1:]) for ref in remote.refs]
        branches = [name for name in branch_names if name not in self.IGNORED_BRANCHES]

        commits = []
        if repo.head.ref:  # Handle repo with no commits.
            for commit in repo.iter_commits(branch, max_count=10):
                committed_date = datetime.datetime.utcfromtimestamp(commit.committed_date)
                commits.append({
                    'message': commit.message,
                    'commit_date': committed_date.isoformat(),
                    'sha': commit.hexsha,
                    'author': {
                        'name': commit.author.name,
                        'email': commit.author.email,
                    },
                })

        self.data = {
            'repo': {
                'web_url': web_url,
                'remote_url': remote_url,
                'revision': revision,
                'branch': branch,
                'branches': branches,
                'commits': commits,
            },
        }

    def get_templates(self):
        """Handle the request for template information."""
        templates = {}

        collections = self.pod.list_collections()

        # Check each collection to see if it has defined the template file.
        for collection in collections:
            template_info = self._get_collection_templates(collection)
            if not template_info:
                continue

            templates[collection.pod_path] = {}

            for key, template_meta in template_info.items():
                screenshots = {}

                # Find any existing screenshots.
                screenshot_pod_dir = self._get_screenshot_dir()
                screenshot_file_base = self._format_screenshot_base(collection.pod_path, key)
                resolutions = self._get_resolutions()

                for resolution in resolutions:
                    screenshot_pod_path = os.path.join(
                        screenshot_pod_dir, resolution.filename(screenshot_file_base))
                    if self.pod.file_exists(screenshot_pod_path):
                        screenshots[resolution.resolution] = self._load_static_doc(screenshot_pod_path)

                templates[collection.pod_path][key] = {
                    'label': template_meta.get('label', key),
                    'description': template_meta.get('description', ''),
                    'screenshots': screenshots,
                }

        self.data = {
            'templates': templates,
        }

    def handle_request(self):
        """Determine how to handle the request."""

        path = self.matched.params['path']
        method = self.request.method
        if path == 'content':
            if method == 'GET':
                self.get_editor_content()
            elif method == 'POST':
                self.post_editor_content()
        elif path == 'content/copy':
            if method == 'GET':
                self.copy_pod_path()
        elif path == 'content/delete':
            if method == 'GET':
                self.delete_pod_path()
        elif path == 'content/template':
            if method == 'GET':
                self.content_from_template()
        elif path == 'extension/config':
            if method == 'GET':
                self.get_extension_config()
        elif path == 'image':
            if method == 'POST':
                self.post_image()
        elif path == 'partials':
            if method == 'GET':
                self.get_partials()
        elif path == 'strings':
            if method == 'GET':
                self.get_strings()
        elif path == 'routes':
            if method == 'GET':
                self.get_routes()
        elif path == 'pod_paths':
            if method == 'GET':
                self.get_pod_paths()
        elif path == 'pod':
            if method == 'GET':
                self.get_pod()
        elif path == 'repo':
            if method == 'GET':
                self.get_repo()
        elif path == 'screenshot/partial':
            if method == 'GET':
                self.screenshot_partial()
        elif path == 'screenshot/template':
            if method == 'GET':
                self.screenshot_template()
        elif path == 'static_serving_path':
            if method == 'GET':
                self.get_static_serving_path()
        elif path == 'templates':
            if method == 'GET':
                self.get_templates()
        else:
            # TODO Give 404 response.
            raise NotFound('{} not found.'.format(path))

    def post_editor_content(self):
        """Handle the request to save editor content."""

        pod_path = self._get_post('pod_path')
        doc = self.pod.get_doc(pod_path)
        if self._has_post('raw_front_matter'):
            front_matter_content = self._get_post('raw_front_matter')
            front_matter_content = front_matter_content.encode('utf-8')
            doc.format.front_matter.update_raw_front_matter(front_matter_content)
            doc.write()
        elif self._has_post('front_matter'):
            fields = json.loads(self._get_post('front_matter'))
            fields = yaml_conversion.convert_fields(fields)

            if self._has_post('content'):
                content = self._get_post('content')
                content = content.encode('utf-8')
                content = self.force_string(content)
                doc.write(fields=fields, body=content)
            else:
                doc.write(fields=fields)

        self.pod.podcache.document_cache.remove(doc)
        self.data = self._load_doc(pod_path)

    def post_image(self):
        """Handle the request to save an image."""
        destination = self._get_post('destination')
        upload_file = self._get_post('file')
        file_contents = upload_file.file.read()

        # Generate a random filename if the upload was a blob.
        filename = upload_file.filename
        if filename == 'blob' or not filename:
            file_extension = self.MIME_TO_TYPE[upload_file.type]
            # Hash the content to come up with a name.
            hash_digest = hashlib.sha256()
            hash_digest.update(file_contents)
            filename = '{}.{}'.format(hash_digest.hexdigest(), file_extension)

        pod_path = os.path.join(destination, filename)
        self.pod.write_file(pod_path, file_contents)
        self.data = self._load_static_doc(pod_path)

    def screenshot_partial(self):
        """Handle the request to screenshot a partial."""
        partial_key = self._get_param('partial')

        keys = []
        key = self._get_param('key')
        if key:
            keys.append(key)
        else:
            partial = self.pod.partials.get_partial(partial_key)
            editor_config = partial.config.get('editor', {})
            for key in editor_config.get('examples', {}).keys():
                keys.append(key)

        self.data = {
            partial_key: {},
        }

        if not keys:
            return

        screenshot_pod_dir = self._get_screenshot_dir()
        resolutions = self._get_resolutions()

        screenshot_config = self.ext_config.get('screenshots', {})
        screenshot_partials_config = screenshot_config.get('partials', {})
        driver_path = os.environ.get(
            screenshot.ENV_DRIVER_PATH, screenshot_config.get('driver_path'))
        screenshotter = screenshot.EditorScreenshot(driver_path)

        for key in keys:
            screenshot_file_base = self._format_screenshot_base(partial_key, key)
            url = 'http://{host}/_grow/screenshot/partial/{screenshot_file_base}'.format(
                host=self.request.host,
                screenshot_file_base=screenshot_file_base)

            try:
                screenshots = screenshotter.screenshot(url, resolutions)
            except selenium_exceptions.WebDriverException as selenium_exception:
                if 'executable' in selenium_exception.msg:
                    raise BadRequest(
                        'Bad chromedriver path or {} not set.'.format(screenshot.ENV_DRIVER_PATH))
                raise

            for resolution, shot in screenshots.items():
                screenshot_pod_path = os.path.join(
                    screenshot_pod_dir, 'partials', resolution.filename(screenshot_file_base))
                self.pod.write_file(screenshot_pod_path, shot)
                if not key in self.data[partial_key]:
                    self.data[partial_key][key] = {}
                self.data[partial_key][key][resolution.resolution] = self._load_static_doc(screenshot_pod_path)

    def screenshot_template(self):
        """Handle the request to screenshot a preview."""
        collection_path = self._get_param('collection_path')
        if not collection_path.startswith('/'):
            collection_path = '/{}'.format(collection_path)
        if not collection_path.endswith('/'):
            collection_path = '{}/'.format(collection_path)

        keys = []
        key = self._get_param('key')
        if key:
            keys.append(key)
        else:
            # Do screenshots for all templates if no key provided.
            collection = self.pod.get_collection(collection_path)
            template_info = self._get_collection_templates(collection)
            for key in template_info:
                keys.append(key)

        self.data = {
            collection_path: {},
        }

        if not keys:
            return

        screenshot_pod_dir = self._get_screenshot_dir()
        resolutions = self._get_resolutions()

        screenshot_config = self.ext_config.get('screenshots', {})
        driver_path = os.environ.get(
            screenshot.ENV_DRIVER_PATH, screenshot_config.get('driver_path'))
        screenshotter = screenshot.EditorScreenshot(driver_path)

        for key in keys:
            screenshot_file_base = self._format_screenshot_base(collection_path, key)

            url = 'http://{host}/_grow/screenshot/template/{screenshot_file_base}'.format(
                host=self.request.host,
                screenshot_file_base=screenshot_file_base)

            try:
                screenshots = screenshotter.screenshot(url, resolutions)
            except selenium_exceptions.WebDriverException as selenium_exception:
                if 'executable' in selenium_exception.msg:
                    raise BadRequest(
                        'Bad chromedriver path or {} not set.'.format(screenshot.ENV_DRIVER_PATH))
                raise

            for resolution, shot in screenshots.items():
                screenshot_pod_path = os.path.join(
                    screenshot_pod_dir, resolution.filename(screenshot_file_base))
                self.pod.write_file(screenshot_pod_path, shot)
                if not key in self.data[collection_path]:
                    self.data[collection_path][key] = {}
                self.data[collection_path][key][resolution.resolution] = self._load_static_doc(screenshot_pod_path)


def serve_api(pod, request, matched, **_kwargs):
    """Serve the default console page."""
    api = PodApi(pod, request, matched)
    return api.response
