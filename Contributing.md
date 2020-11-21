# Contributing

## Development

1. Clone this project, and clone `selective-edit`. Then, run the watch script
   to regenerate files.

```
git clone git@github.com:grow/grow-ext-editor.git
git clone git@github.com:grow/selective-edit.git
cd selective-edit
npm link
cd ../grow-ext-editor
make develop
cd editor
npm link selective-edit
make watch
```

2. From your Grow site repository, manually symlink the editor extension.

```
cd <repo>
rm -rf extensions/editor
ln -s ../../grow-ext-editor/editor/ extensions/editor
```

3. Run the Grow development server and iterate.

```
http://localhost:8080/_grow/editor
```

## Committing

Commit generated files from `dist` because there is no build step and the
generated files are required by the Grow extension.

## Using newest version

Ensure your Grow site's `extensions.txt` corresponds to the latest committed
version, otherwise changes won't be picked up outside your local machine.
