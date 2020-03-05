# Grow Editor Extension

Status: **In Development**

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

The editor can be viewed at `/_grow/editor/`.

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

### Collection Configuration

In collections, the `_editor.yaml` file determines which
fields to show in the editor. If no configuration file exists for a
collection the editor attempts to guess the field types by the values
of the content.

```yaml
# /content/pages/_editor.yaml
fields:
- type: text
  key: $title
  label: Title
- type: textarea
  key: meta.description
  label: Description
- type: partials
  key: partials
  label: Partials
```

### Partial Configuration

Partials in the `/view/partials` directory can add front matter to their
partials to configure how the partial should be displayed in the editor.

```html
---
# /views/partials/hero.html
editor:
  label: Hero
  fields:
  - type: text
    key: title
    label: Title
  - type: text
    key: subtitle
    label: Sub Title
---
<div class="hero">
   ...
</div>
```

Partials can also define a `_editor.yaml` file in their main directory to provide the editor with information on how the partial should be displayed for editing.

```yaml
# /partials/hero/_editor.yaml
editor:
  label: Hero
  fields:
  - type: text
    key: title
    label: Title
  - type: text
    key: subtitle
    label: Sub Title
  - type: text
    key: cta.text
    label: CTA Title
```

### Field Configuration

The key of the field is used to retrieve the value to be edited from the document.
To access nested data use the `.` to separate out key names.

For example, with a document that has a `meta` value:

```yaml
# /content/pages/example.yaml
$title: Example page
meta:
  description: Example description
```

The field can be configured to edit the title and description like so:

```yaml
# /content/pages/_editor.yaml
editor:
  fields:
  - type: text
    key: $title
    label: Title
  - type: text
    key: meta.description
    label: Description
```

The following field types are currently available for use in the editor configurations:

- `text` - Standard text field.
- `textarea` - Standard textarea field.
- `markdown` - Uses a markdown editor to work with the content.
- `partials` - shows the fields for all partials when editor configuration is defined.

## Development

To develop the editor extension you need to run a command to watch and compile the
code:

```sh
cd editor
yarn install
yarn run watch
```

To test the changes in another tab run:

```sh
cd example
cd extensions/editor && ln -s ../../../editor/dist/ dist
grow run
```

And visit [/_grow/editor/](http://localhost:8080/_grow/editor/)
