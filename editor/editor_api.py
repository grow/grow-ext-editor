"""API Handler for serving api requests."""

from __future__ import print_function
import datetime
import json
import os
import re
import yaml
from werkzeug import wrappers
from grow.common import json_encoder
from grow.common import utils
from grow.common import yaml_utils
from grow.documents import document
from grow.documents import document_front_matter
from grow.routing import router as grow_router


class PodApi(object):
    """Basic pod api."""

    DATE_RE = re.compile(r'^[\d]{4}-[\d]{2}-[\d]{2}$')
    DATETIME_RE = re.compile(r'^[\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}$')
    EDITOR_FILE_NAME = '_editor.yaml'
    PARTIALS_VIEWS_PATH = '/views/partials'
    STRINGS_PATH = '/content/strings'
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

    def _convert_fields(self, fields):
        """Convert raw field data from submission to use objects when needed."""
        # Convert the !g constructors into their objects.
        def _walk_field(item, key, node, parent_node):
            # Convert dates.
            try:
                value = node[key]
                if self.DATETIME_RE.match(value):
                    node[key] = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M")
                elif self.DATE_RE.match(value):
                    tempValue = datetime.datetime.strptime(value, "%Y-%m-%d")
                    node[key] = datetime.date(tempValue.year, tempValue.month, tempValue.day)
            except:
                pass

            # Convert constructors.
            if key == 'tag' and item.startswith('!g.') and 'value' in node:
                newValue = ConstructorReference(item, node['value'])

                try:
                    # Try as an array.
                    for index, parent_key in enumerate(parent_node):
                        if parent_node[index] == node:
                            parent_node[index] = newValue
                            break
                except KeyError:
                    # Try as a dict.
                    for parent_key in parent_node:
                        if parent_node[parent_key] == node:
                            parent_node[parent_key] = newValue


        utils.walk(fields, _walk_field)

        return fields

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
        return yaml.load(self.pod.read_file(editor_path), Loader=yaml.FullLoader) or {}

    def _editor_config_partial(self, partial):
        """Return the editor configuration for the partial."""
        editor_path = '{}/{}'.format(partial.pod_path, self.EDITOR_FILE_NAME)
        if self.pod.file_exists(editor_path):
            return yaml.load(self.pod.read_file(editor_path), Loader=yaml.FullLoader) or {}
        return {}

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
                'raw_front_matter': '',
                'content': '',
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
            'raw_front_matter': raw_front_matter,
            'content': doc.body,
        }

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
        pod_path = self.request.params.get('pod_path')
        self.data = self._load_doc(pod_path)

    def get_extension_config(self):
        """Handle the request for editor content."""
        extension_path = self.request.params.get('extension_path')

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
            editor_config = self._editor_config_partial(partial)
            if editor_config:
                partials[partial.key] = editor_config

        # View partials.
        view_pod_paths = []
        split_front_matter = document_front_matter.DocumentFrontMatter.split_front_matter
        for root, dirs, files in self.pod.walk(self.PARTIALS_VIEWS_PATH):
            pod_dir = root.replace(self.pod.root, '')
            for file_name in files:
                view_pod_paths.append(os.path.join(pod_dir, file_name))

        for view_pod_path in view_pod_paths:
            partial_key, _ = os.path.splitext(os.path.basename(view_pod_path))
            front_matter, _ = split_front_matter(self.pod.read_file(view_pod_path))
            if front_matter:
                editor_config = utils.parse_yaml(
                    front_matter, pod=self.pod, locale=None) or {}
                partials[partial_key] = editor_config.get('editor', {})

        self.data = {
            'partials': partials,
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
        repo = utils.get_git_repo(self.pod.root)
        if not repo:
            return {}
        branch = str(repo.active_branch)
        revision = repo.git.rev_list('--count', 'HEAD')
        remote_url = None
        web_url = None
        if repo.remotes and repo.remotes[0]:
            urls = list(repo.remotes[0].urls)
            remote_url = urls and urls[0]
            # TODO(jeremydw): Genericize this.
            web_url = remote_url and remote_url.replace('git@github.com:', 'https://www.github.com/')
            if web_url and web_url.endswith('.git'):
                web_url = web_url[:-4]
        commits = []
        # Handle repo with no commits.
        if repo.head.ref:
            for commit in repo.iter_commits(branch, max_count=10):
                commits.append({
                    'message': commit.message,
                    'commit_date': commit.committed_date,
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
                'commits': commits,
            },
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
        elif path == 'extension/config':
            if method == 'GET':
                self.get_extension_config()
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
        elif path == 'repo':
            if method == 'GET':
                self.get_repo()

    def post_editor_content(self):
        """Handle the request to save editor content."""

        pod_path = self.request.POST['pod_path']
        doc = self.pod.get_doc(pod_path)
        if 'raw_front_matter' in self.request.POST:
            front_matter_content = self.request.POST['raw_front_matter']
            front_matter_content = front_matter_content.encode('utf-8')
            doc.format.front_matter.update_raw_front_matter(front_matter_content)
            doc.write()
        elif 'front_matter' in self.request.POST:
            fields = json.loads(self.request.POST['front_matter'])
            fields = self._convert_fields(fields)

            # TODO: Array updates don't work well.
            doc.format.front_matter.update_fields(fields)
            if 'content' in self.request.POST:
                content = self.request.POST['content']
                content = content.encode('utf-8')
                doc.write(body=content)
            else:
                doc.write()

        self.pod.podcache.document_cache.remove(doc)
        self.data = self._load_doc(pod_path)


def serve_api(pod, request, matched, **_kwargs):
    """Serve the default console page."""
    api = PodApi(pod, request, matched)
    return api.response


# Allow the yaml dump to write out a representation of the !g.yaml.
def g_representer(dumper, data):
    return dumper.represent_scalar(data.tag, data.pod_path)


class ConstructorReference:
    """Helper class to serialize !g.* fields."""

    def __init__(self, tag, pod_path):
        self.tag = tag
        self.pod_path = pod_path

yaml.SafeDumper.add_representer(ConstructorReference, g_representer)
