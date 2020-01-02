# Grow Editor Extension

Note: **Experimental**

Extension for using an editor interface to edit content files.

## Usage

### Initial setup

1. Create an `extensions.txt` file within your pod.
1. Add to the file: `git+git://github.com/grow/grow-ext-editor`
1. Run `grow install`.
1. Add the following section to `podspec.yaml`:

```
ext:
- extensions.editor.EditorExtension
```

When the extension is enabled (on by default) the editor UI JS and CSS will be added to the build output.

The editor can be viewed at `/_grow/ext/editor/`.

### Environment specific configuration.

The extension can be disabled by using environment tagging:

For example:

```
ext:
- extensions.editor.EditorExtension
    enabled@env.prod: False

deployments:
  prod:
    destination: local
    out_dir: build/
    env:
      name: prod
```

### Configuration

The editor uses the `_editor.yaml` file in the collection to determine which fields to allow the editor to display.

Partials can also define a `editor.yaml` file in their main directory to provide the editor with information on how the partial should be displayed for editing.
