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
- extensions.editor.EditorExtension:
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

- `checkbox` - Checkbox boolean field.
- `date` - Date field.
- `datetime` - Datetime field.
- `document` - Grow document reference. Appears as `!g.doc ...` in yaml.
- `google_image` - Image field for uploading an image to Google Cloud Storage. (Requires configuration.)
- `group` - Groups together other fields to make them expand/collapse in a group.
- `image` - Image field for uploading an image to the local filesystem.
- `html` - Rich editor for HTML content.
- `list` - List field for controlling lists of values.
- `markdown` - Rich editor for Markdown content.
- `partials` - shows the fields for all partials when editor configuration is defined.
- `select` - Ability to provide a list of options to choose between. Also works as a multi-select.
- `string` - Grow string reference field. Allows for referencing strings from the `/content/strings/` files. Appears as `!g.string ...` in yaml.
- `text` - Standard text field. Converts from input to textarea when text becomes longer.
- `textarea` - Standard textarea field.
- `variant` - Show different sets of sub fields based on a selected variant.
- `yaml` - Grow yaml file reference. Appears as `!g.yaml ...` in yaml.

## Development

Note: The editor requires the (`selective-edit`)[https://github.com/grow/selective-edit] library.
For development the `selective-edit` library should be cloned and linked (using `yarn link`) first to make development seamless.

To develop the editor extension you need to run a command to watch and compile the
code:

```sh
cd editor
yarn install
# After you have cloned and linked the selective-edit project:
yarn link selective-edit
yarn run watch
```

To test the changes in another tab run:

```sh
grow install example
grow run example
```

And visit [/_grow/editor/](http://localhost:8080/_grow/editor/)
